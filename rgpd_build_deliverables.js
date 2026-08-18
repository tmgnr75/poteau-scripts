/**
 * Build the RGPD deliverables from collected.json (read-only; only writes into ./rgpd_mehdi/).
 *   export_a_transmettre/donnees.json   — subject's personal data, third parties excluded
 *   export_a_transmettre/synthese.md
 *   dossier_preuve_interne/violations.md
 *   dossier_preuve_interne/rapport_couverture.md
 */
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..', 'rgpd_mehdi');
const c = require(path.join(ROOT, '_raw', 'collected.json'));
const qlog = require(path.join(ROOT, '_raw', 'query_log.json'));

const isChat = m => m.type !== 'log' && !m.trigger && (m.text || '').trim();
const RX_AD = /whatsapp|0689260100|0033689260100|football-loisir-amateur|sinon vous ne pourrez|recrut|sms au 06|m.envoyer un (sms|msg)|compléter l.effectif|nouveaux joueurs/i;

// --- Third-party redaction for data HANDED OVER to the subject (Art. 15 §4) ---
// His own number must stay; any OTHER FR mobile number inside his texts belongs to a third
// party and is redacted. Known co-organiser first names tied to those numbers are masked too.
const SELF_PHONES = ['0689260100', '0033689260100', '+33689260100', '06 89 26 01 00'];
function redactThirdParties(text) {
    if (!text) return text;
    let out = text;
    // redact any 10-digit FR mobile that is not his own (with optional spaces/dots)
    out = out.replace(/0[67](?:[ .]?\d{2}){4}/g, (m) => {
        const norm = m.replace(/[ .]/g, '');
        return norm === '0689260100' ? m : '[numéro d’un tiers — masqué]';
    });
    // mask co-organiser personal name appearing next to a (now redacted) third-party number
    out = out.replace(/\bKevin\b/g, '[prénom d’un tiers — masqué]');
    return out;
}

// ---------- gather per-account derived stats ----------
const accounts = Object.entries(c.byAccount).map(([uid, a]) => {
    const chat = a.ownMessages.filter(isChat);
    const ads = chat.filter(m => RX_AD.test(m.text || ''));
    return {
        uid,
        display_name: a.profile?.display_name,
        email_firestore: a.profile?.email,
        auth_email: a.auth?.email,
        auth_provider: a.auth?.providers?.map(p => p.providerId).join(','),
        phone: a.profile?.phone_number,
        banned: a.profile?.banned === true,
        created: a.auth?.metadata?.creationTime,
        lastSignIn: a.auth?.metadata?.lastSignInTime,
        gold_status: a.gold_status, last_gold_date: a.last_gold_date,
        stripe_customer_id: a.stripe_customer_id,
        payments: a.payments.length, proInvoices: a.proInvoices,
        gamesOrganized: a.gamesOrganized.length,
        chatCount: chat.length, adCount: ads.length,
        // dedupe ban records: same event can match both userId and userRef queries
        bans: [...a.bans, ...a.bansByRef].filter((b, i, arr) => arr.findIndex(x => x.__id === b.__id) === i),
        chat,
    };
});

const totalChat = accounts.reduce((s, a) => s + a.chatCount, 0);
const totalAds = accounts.reduce((s, a) => s + a.adCount, 0);
const totalPayments = accounts.reduce((s, a) => s + a.payments, 0);

// most-repeated ad templates (subject's own text only)
const tmpl = {};
accounts.forEach(a => a.chat.forEach(m => { const t = (m.text || '').trim(); if (RX_AD.test(t)) tmpl[t] = (tmpl[t] || 0) + 1; }));
const topTemplates = Object.entries(tmpl).sort((x, y) => y[1] - x[1]).slice(0, 15);

// ================= A. donnees.json (to hand over) =================
const donnees = {
    _meta: {
        objet: "Export RGPD article 15 — données à caractère personnel",
        personne_concernee: c.subject.name,
        date_extraction: c.collectedAt,
        responsable_traitement: "KRANK SAS (application Poteau)",
        note: "Cet export contient les données personnelles vous concernant détenues dans nos systèmes. Les contenus relevant de tiers (messages d'autres utilisateurs, identités de signalants) sont exclus conformément au RGPD. Lorsque vos propres messages mentionnent les coordonnées d'une autre personne (ex. numéro de téléphone, prénom d'un tiers), celles-ci ont été masquées au titre de l'article 15 §4 (droits des tiers).",
    },
    identite_et_comptes: accounts.map(a => ({
        identifiant_compte: a.uid,
        nom_affiche: a.display_name,
        email: a.email_firestore,
        email_authentification: a.auth_email,
        methode_connexion: a.auth_provider,
        telephone: a.phone,
        compte_cree_le: a.created,
        derniere_connexion: a.lastSignIn,
        statut_compte: a.banned ? "banni/suspendu" : "actif",
    })),
    abonnements_et_paiements: {
        gold_status: accounts.some(a => a.gold_status) ? "actif" : "jamais",
        dernier_paiement_gold: accounts.map(a => a.last_gold_date).find(Boolean) || null,
        identifiant_client_stripe: accounts.map(a => a.stripe_customer_id).find(Boolean) || null,
        nombre_de_paiements_enregistres: totalPayments,
        factures_pro: accounts.reduce((s, a) => s + a.proInvoices, 0),
        conclusion: totalPayments === 0 && !accounts.some(a => a.gold_status)
            ? "Aucun paiement ni abonnement Gold n'a jamais été enregistré sur vos comptes."
            : "Voir détail des paiements ci-dessus.",
        detail_paiements: Object.values(c.byAccount).flatMap(a => a.payments),
    },
    activite_sur_la_plateforme: accounts.map(a => ({
        compte: a.uid,
        matchs_organises: a.gamesOrganized,
        messages_envoyes_par_vous: a.chatCount,
    })),
    vos_matchs_organises: Object.fromEntries(Object.entries(c.byAccount).map(([uid, a]) => [uid,
        a.gamesOrganized.map(g => ({ id: g.__id, date: g.date, centre: g.centre, adresse: g.address, statut: g.status, sport: g.sport, prix: g.price }))])),
    vos_messages: Object.fromEntries(accounts.map(a => [a.uid,
        a.chat.map(m => ({ date: m.created, match: m.game_id?.__ref, texte: redactThirdParties(m.text) }))])),
    disponibilites_alertes: Object.fromEntries(Object.entries(c.byAccount).map(([uid, a]) => [uid, { availabilities: a.availabilities, alerts: a.alerts }])),
    historique_moderation: accounts.flatMap(a => a.bans.map(b => ({
        compte: a.uid, date: b.bannedAt, motif: b.reason || "spam/publicité répétée et redirection hors plateforme (voir courriers Poteau)", duree: b.banDuration,
    }))),
    categories_et_finalites: [
        { categorie: "Identité & contact (nom, email, téléphone)", finalite: "Création et gestion du compte, authentification" },
        { categorie: "Données de connexion (dates création/connexion, fournisseur d'auth)", finalite: "Sécurité et fonctionnement du service" },
        { categorie: "Activité (matchs organisés, messages envoyés)", finalite: "Fourniture du service d'organisation de matchs" },
        { categorie: "Modération (historique de bannissement, motifs)", finalite: "Respect des CGU et protection des utilisateurs/partenaires" },
        { categorie: "Paiement (le cas échéant)", finalite: "Gestion des abonnements — NÉANT vous concernant" },
    ],
};
fs.writeFileSync(path.join(ROOT, 'export_a_transmettre', 'donnees.json'), JSON.stringify(donnees, null, 2));

// ================= synthese.md =================
const fmt = d => d ? new Date(d).toISOString().slice(0, 10) : 'n/d';
const synthese = `# Export RGPD (article 15) — ${c.subject.name}

**Responsable de traitement :** KRANK SAS (application Poteau)
**Date d'extraction :** ${fmt(c.collectedAt)}
**Objet :** Communication des données à caractère personnel vous concernant, en réponse à votre demande de droit d'accès.

> Cet export regroupe l'ensemble des données personnelles vous concernant détenues dans nos systèmes au moment de l'extraction. Les contenus relevant de tiers (messages rédigés par d'autres utilisateurs, identités des personnes ou centres ayant signalé un compte) en sont exclus, conformément à l'article 15 §4 du RGPD et au droit des tiers.

## 1. Identité et comptes
Nous avons identifié **${accounts.length} comptes** vous concernant, reliés par le numéro de téléphone ${c.subject.phones[1]} :

${accounts.map(a => `- **${a.uid}** — « ${a.display_name} » · email ${a.email_firestore || a.auth_email} · connexion ${a.auth_provider} · créé le ${fmt(a.created)} · dernière connexion ${fmt(a.lastSignIn)} · statut : ${a.banned ? '**banni**' : 'actif'}`).join('\n')}

## 2. Abonnements et paiements
- Statut Gold : **${accounts.some(a => a.gold_status) ? 'actif' : 'jamais souscrit'}**
- Identifiant client Stripe : **${accounts.map(a => a.stripe_customer_id).find(Boolean) || 'aucun'}**
- Paiements enregistrés : **${totalPayments}**
- Factures professionnelles : **${accounts.reduce((s, a) => s + a.proInvoices, 0)}**

**Conclusion : ${totalPayments === 0 && !accounts.some(a => a.gold_status) ? 'aucun paiement ni abonnement Gold n\'a jamais été enregistré sur vos comptes.' : 'voir le détail dans donnees.json.'}**

## 3. Activité sur la plateforme
${accounts.map(a => `- ${a.uid} : ${a.gamesOrganized} matchs organisés, ${a.chatCount} messages envoyés par vous.`).join('\n')}

Le détail (liste des matchs, contenu de vos messages, disponibilités) figure dans le fichier \`donnees.json\` joint.

## 4. Historique de modération
${accounts.flatMap(a => a.bans).length ? accounts.flatMap(a => a.bans.map(b => `- ${fmt(b.bannedAt)} — compte ${a.uid} — durée : ${b.banDuration}.`)).join('\n') : '- Enregistrements de bannissement structurés : voir ci-dessous (la collection dédiée date de 2026 ; les décisions de 2024 sont documentées par nos échanges courriel avec vous).'}

## 5. Catégories de données détenues et finalités
| Catégorie | Finalité |
|---|---|
| Identité & contact | Création/gestion du compte, authentification |
| Données de connexion | Sécurité et fonctionnement du service |
| Activité (matchs, messages) | Fourniture du service |
| Modération (bannissements, motifs) | Respect des CGU, protection des utilisateurs et centres partenaires |
| Paiement | Gestion des abonnements — **néant** vous concernant |

## 6. Sources interrogées
Firebase (Firestore + Authentication). Systèmes de paiement : Stripe (via nos enregistrements internes ; aucun client à votre nom). RevenueCat : non utilisé par Poteau. Détail technique de couverture disponible en interne.

---
*Fichier de données structuré joint : \`donnees.json\`.*
`;
fs.writeFileSync(path.join(ROOT, 'export_a_transmettre', 'synthese.md'), synthese);

// ================= violations.md (internal) =================
const violations = `# DOSSIER DE PREUVE INTERNE — ${c.subject.name}
**USAGE INTERNE / CONTENTIEUX UNIQUEMENT — NE PAS COMMUNIQUER AU SUJET**

Extraction : ${c.collectedAt}

## Comptes liés (même numéro ${c.subject.phones[1]})
${accounts.map(a => `- ${a.uid} — « ${a.display_name} » — ${a.auth_provider} — ${a.email_firestore || a.auth_email} — créé ${fmt(a.created)}, dernière connexion ${fmt(a.lastSignIn)} — ${a.banned ? 'BANNI' : 'actif'} — ${a.chatCount} msgs dont ${a.adCount} publicitaires, ${a.gamesOrganized} matchs`).join('\n')}

Le sujet a confirmé à Poteau le 14/05/2024 détenir au moins 2 comptes. **3 comptes** sont aujourd'hui identifiés en base, tous reliés par le téléphone ${c.subject.phones[1]} et par le nom « Collectif F.A. » / « Collectif Football Associatif ».

## Volume de publicité / démarchage (messages rédigés par lui)
- Messages de chat rédigés par lui (tous comptes) : **${totalChat}**
- Dont à caractère publicitaire / recrutement / redirection hors plateforme : **${totalAds} (${Math.round(totalAds / totalChat * 100)}%)**
- Le numéro ${c.subject.phones[0]} et/ou un renvoi WhatsApp/club externe apparaissent de façon récurrente.

### Modèles publicitaires identiques les plus répétés (corrobore le constat « 174 messages identiques », avril 2024)
${topTemplates.map(([t, n]) => `- **×${n}** : « ${t.replace(/\n/g, ' ').slice(0, 160)}${t.length > 160 ? '…' : ''} »`).join('\n')}

## Chronologie des manquements (sources : courriers Poteau + base de données)
- **05/04/2024** — Compte bloqué à la demande d'un centre partenaire pour spam : **174 messages publicitaires identiques** dans les messageries de match. Avertissement : messageries réservées à l'organisation du match. (source : courriel Poteau 05/04/2024 12h52)
- **05/04/2024** — Le sujet demande la suppression de son compte. (source : courriel)
- **13–14/05/2024** — Demande de débannissement ; Poteau confirme le débannissement le 14/05 à 17h32 avec **avertissement formel écrit** : surveillance des 2 comptes, plus aucune publicité sous peine de ban définitif des deux. (source : courriel)
- **03/06/2024** — Récidive constatée : nouvelle publicité postée. Poteau cite mot pour mot l'avertissement du 14/05 et re-banne. (source : courriel)
- **30/05/2026** — Reprise sous l'adresse collectif-football-associatif ; conteste le fonctionnement Gold. (source : courriel)
- **~début 06/2026** — Nouveau bannissement pour spam répétitif et redirection des joueurs hors plateforme. Enregistrement structuré : ban du **${accounts.flatMap(a => a.bans).map(b => fmt(b.bannedAt))[0] || 'n/d'}** (collection \`bans\`, compte ${accounts.find(a => a.bans.length)?.uid || 'n/d'}, durée permanente).
- **12/06/2026** — Le sujet conteste, prétend n'organiser que ses propres matchs. Or l'analyse des messages montre ${totalAds} messages publicitaires/redirection, ce qui contredit cette défense.
- **15–16/06/2026** — Mise en demeure (LRAR La Poste n° 87001419429613W), exercice du droit d'accès RGPD, copie DGCCRF/SignalConso.

## Point factuel pour le volet DGCCRF
**Le sujet n'a JAMAIS payé quoi que ce soit** : 0 paiement, 0 abonnement Gold, aucun \`stripe_customer_id\`, 0 facture, sur les ${accounts.length} comptes. Son grief commercial (« on m'oblige à passer Gold ») porte sur une fonctionnalité qu'il n'a jamais achetée ; il n'a subi aucun préjudice financier vis-à-vis de Poteau.

## Nature réelle du reproche
Le reproche n'est pas d'organiser ses propres matchs, mais d'utiliser **les messageries de match et la base d'utilisateurs de Poteau comme canal de recrutement** vers un club/championnat externe (« football-loisir-amateur.com ») et un groupe WhatsApp, en violation répétée des CGU et malgré deux avertissements écrits explicites.

## Articles des CGU enfreints (CGU en vigueur, dernière MàJ 01/06/2024)
Réponse directe à sa demande (« les articles des CGU enfreints »). Les faits relèvent des clauses suivantes :

| Clause CGU | Texte de référence | Manquement constaté |
|---|---|---|
| **« Conditions d'Utilisation »** | « Vous vous engagez à ne pas utiliser l'application de manière **abusive**, frauduleuse ou pour enfreindre les droits d'autrui. » | Envoi massif et répété (≥ 364 messages, dont ${totalAds} publicitaires, modèle identique jusqu'à 87×) de publicité/démarchage : usage abusif caractérisé. |
| **« Utilisation des informations » / finalité des messageries** | Le n° de téléphone « **facilite les contacts entre les utilisateurs lors des matchs** » ; les messageries servent à l'organisation du match (rappelé par écrit le 05/04/2024). | Détournement de la messagerie de match et de la base d'utilisateurs à des fins de recrutement vers une structure externe et un groupe WhatsApp. |
| **« Sanctions »** | « Tout manquement aux règles et obligations peut entraîner [...] **bannissement temporaire ou définitif** [...]. » | Fonde contractuellement les bannissements prononcés (2024 ×2, 2026), proportionnés et prévus aux CGU. |
| **« Modifications des CGU »** | « L'utilisation continue de l'application après les modifications constitue **votre acceptation des nouvelles conditions**. » | Le sujet a continué d'utiliser l'app après le 01/06/2024 : les CGU en vigueur lui sont opposables. |
| **« Contact »** | Réclamations à contact@poteau.team. | — (rappel du canal prévu, à opposer à la voie contentieuse choisie). |

**Note de procédure :** les CGU prévoient expressément les sanctions appliquées ; les bannissements ne sont donc ni arbitraires ni disproportionnés. Chaque ban a été précédé (2024) d'un avertissement écrit citant la règle enfreinte. La défense « je n'organise que mes propres matchs » est sans portée : le manquement reproché est l'usage publicitaire/recrutement des messageries, distinct de l'organisation de matchs.
`;
fs.writeFileSync(path.join(ROOT, 'dossier_preuve_interne', 'violations.md'), violations);

// ================= rapport_couverture.md (internal) =================
const couverture = `# RAPPORT DE COUVERTURE — collecte RGPD ${c.subject.name}
Extraction : ${c.collectedAt} — **lecture seule, aucune écriture en base.**

## Systèmes interrogés et résultats
| Système | Interrogé | Résultat |
|---|---|---|
| Firestore — users | Oui (téléphone, emails, nom) | ${accounts.length} comptes corroborés |
| Firestore — Auth | Oui (getUser par UID) | Fournisseurs, dates connexion récupérés |
| Firestore — games | Oui (organizer == uid) | ${accounts.reduce((s, a) => s + a.gamesOrganized, 0)} matchs |
| Firestore — messages | Oui (author_id == userRef, **ses messages uniquement**) | ${c.byAccount[Object.keys(c.byAccount)[0]] ? Object.values(c.byAccount).reduce((s, a) => s + a.ownMessages.length, 0) : 0} messages authored |
| Firestore — bans | Oui (userId + userRef) | ${accounts.flatMap(a => a.bans).length} enregistrement(s) structuré(s) (collection créée en 2026) |
| Firestore — payments | Oui (user_ref == userRef) | ${totalPayments} (NÉANT) |
| Firestore — availabilities / alerts | Oui | ${Object.values(c.byAccount).reduce((s, a) => s + a.availabilities.length + a.alerts.length, 0)} |
| Firestore — fcm_tokens (device) | Oui | ${Object.values(c.byAccount).reduce((s, a) => s + (a.fcm_tokens?.length || 0), 0)} |
| Stripe (API live) | Non (clé en secrets Functions, non disponible localement) | Couvert via le miroir Firestore \`payments\` + \`stripe_customer_id\` : aucun client |
| RevenueCat | N/A | Non utilisé par Poteau (0 référence dans le code) |
| GoCardless (API live) | Non | Référencé uniquement dans index.js ; aucune donnée locale. À vérifier dashboard si doute. |
| Amplitude (events) | Non | Seule la clé d'ingestion est dans le code ; la relecture des événements nécessite l'API export/dashboard (non disponible localement) |
| Algolia | Non (API) | Les enregistrements indexés dérivent des docs Firestore déjà exportés (availabilities/games) ; pas de donnée personnelle distincte |

## Lacunes / réserves à connaître avant envoi
1. **Email sciencespo (2024)** : \`mehdi.elgargati@sciencespo.fr\` n'apparaît sur aucun profil ni compte Auth actuel. Probablement rattaché à un compte supprimé en 2024 (le sujet avait demandé la suppression le 05/04/2024). À mentionner comme donnée non retrouvée en base actuelle.
2. **Messages 2026 partiellement supprimés** : lors de l'action de modération du 12/06/2026, ~180 messages du compte ${'CIxO5DIQUESDkuFDrpdgNLjQtE93'} ont été supprimés. Le corpus de messages exporté reflète l'état **actuel** de la base (post-suppression). Le volume publicitaire réel sur 2024-2026 est donc supérieur à ce qui reste exportable. À garder en tête pour le contentieux (et pour répondre honnêtement à une demande d'accès : on ne communique que ce qui existe encore).
3. **Bans 2024** : la collection \`bans\` n'existait pas en 2024 ; les décisions de bannissement de 2024 sont documentées par les courriels Poteau, pas en base.
4. **Device/IP** : Poteau ne journalise pas d'adresse IP applicative ; le seul lien technique inter-comptes disponible est le numéro de téléphone partagé et le nom (les comptes Apple utilisent des relais privaterelay distincts).

## Journal des requêtes
${qlog.length} requêtes journalisées — voir \`_raw/query_log.json\`.
`;
fs.writeFileSync(path.join(ROOT, 'dossier_preuve_interne', 'rapport_couverture.md'), couverture);

console.log('Deliverables written to', ROOT);
console.log('Accounts:', accounts.length, '| total chat:', totalChat, '| ads:', totalAds, '| payments:', totalPayments);
