exports.translateLogs = functions.firestore
    .document("messages/{docId}")
    .onCreate(async (snap, context) => {
        const docData = snap.data();

        // Check if "type" is "log"
        if (docData.type !== "log") {
            return null;
        }

        let trigger = docData.trigger;

        // If trigger is not set, determine it based on the text value
        if (!trigger) {
            const text = docData.text;

            // Define the mapping of text to trigger
            const triggerMapping = {
                "a ajouté 1 ami.": "friend_added",
                "a ajouté un ami.": "friend_added",
                "a ajouté 2 amis.": "friend_added_2",
                "a retiré 1 ami.": "friend_removed",
                "a retiré un ami.": "friend_removed",
                "a retiré 2 amis.": "friend_removed_2",
                "a retiré 3 amis.": "friend_removed_3",
                "a retiré 4 amis.": "friend_removed_4",
                "a annulé le match.": "game_canceled",
                "a créé le match.": "game_created",
                "a ouvert le match à la communauté Poteau.": "game_opened",
                "s'est inscrit.": "player_joined_man",
                "s'est inscrit avec un ami.": "player_joined_man_plus_1",
                "s'est inscrit avec 2 amis.": "player_joined_man_plus_2",
                "s'est inscrit avec 3 amis.": "player_joined_man_plus_3",
                "s'est inscrit avec 4 amis.": "player_joined_man_plus_4",
                "s'est désinscrit.": "player_left_man",
                "s'est désinscrit avec un ami.": "player_left_man_plus_1",
                "s'est désinscrit avec 2 amis.": "player_left_man_plus_2",
                "s'est désinscrit avec 3 amis.": "player_left_man_plus_3",
                "s'est désinscrit avec 4 amis.": "player_left_man_plus_4",
                "s'est désinscrite.": "player_left_woman",
                "s'est désinscrite avec un ami.": "player_left_woman_plus_1",
                "s'est désinscrite avec 2 amis.": "player_left_woman_plus_2",
                "s'est désinscrite avec 3 amis.": "player_left_woman_plus_3",
                "s'est désinscrite avec 4 amis.": "player_left_woman_plus_4"
            };

            // Determine the trigger
            trigger = triggerMapping[text] || null;

            // If no trigger could be determined, set an error flag
            if (!trigger) {
                await snap.ref.update({ error: true });
                return null;
            } else {
                // Update the document with the trigger
                await snap.ref.update({ trigger });
            }
        }

        // Define the translation mapping
        const translationMapping = {
            "friend_added": {
                text: "a ajouté 1 ami.",
                text_en: "added 1 friend.",
                text_es: "añadió 1 amigo.",
                text_it: "ha aggiunto 1 amico."
            },
            "friend_added_2": {
                text: "a ajouté 2 amis.",
                text_en: "added 2 friends.",
                text_es: "añadió 2 amigos.",
                text_it: "ha aggiunto 2 amici."
            },
            "friend_removed": {
                text: "a retiré 1 ami.",
                text_en: "removed 1 friend.",
                text_es: "retiró 1 amigo.",
                text_it: "ha rimosso 1 amico."
            },
            "friend_removed_2": {
                text: "a retiré 2 amis.",
                text_en: "removed 2 friends.",
                text_es: "retiró 2 amigos.",
                text_it: "ha rimosso 2 amici."
            },
            "friend_removed_3": {
                text: "a retiré 3 amis.",
                text_en: "removed 3 friends.",
                text_es: "retiró 3 amigos.",
                text_it: "ha rimosso 3 amici."
            },
            "friend_removed_4": {
                text: "a retiré 4 amis.",
                text_en: "removed 4 friends.",
                text_es: "retiró 4 amigos.",
                text_it: "ha rimosso 4 amici."
            },
            "game_canceled": {
                text: "a annulé le match.",
                text_en: "canceled the game.",
                text_es: "canceló el partido.",
                text_it: "ha cancellato la partita."
            },
            "game_created": {
                text: "a créé le match.",
                text_en: "created the game.",
                text_es: "creó el partido.",
                text_it: "ha creato la partita."
            },
            "game_opened": {
                text: "a ouvert le match à la communauté Poteau.",
                text_en: "opened the game to the Poteau community.",
                text_es: "abrió el partido a la comunidad Poteau.",
                text_it: "ha aperto la partita alla comunità Poteau."
            },
            "player_joined_man": {
                text: "a rejoint le match.",
                text_en: "joined the game.",
                text_es: "se inscribió.",
                text_it: "si è unito alla partita."
            },
            "player_joined_man_plus_1": {
                text: "a rejoint le match avec un ami.",
                text_en: "joined the game with 1 friend.",
                text_es: "se inscribió con 1 amigo.",
                text_it: "si è unito alla partita con 1 amico."
            },
            "player_joined_man_plus_2": {
                text: "a rejoint le match avec 2 amis.",
                text_en: "joined the game with 2 friends.",
                text_es: "se inscribió con 2 amigos.",
                text_it: "si è unito alla partita con 2 amici."
            },
            "player_joined_man_plus_3": {
                text: "a rejoint le match avec 3 amis.",
                text_en: "joined the game with 3 friends.",
                text_es: "se inscribió con 3 amigos.",
                text_it: "si è unito alla partita con 3 amici."
            },
            "player_joined_man_plus_4": {
                text: "a rejoint le match avec 4 amis.",
                text_en: "joined the game with 4 friends.",
                text_es: "se inscribió con 4 amigos.",
                text_it: "si è unito alla partita con 4 amici."
            },
            "player_joined_woman": {
                text: "a rejoint le match.",
                text_en: "joined the game.",
                text_es: "se inscribió.",
                text_it: "si è unita alla partita."
            },
            "player_joined_woman_plus_1": {
                text: "a rejoint le match avec un ami.",
                text_en: "joined the game with 1 friend.",
                text_es: "se inscribió con 1 amigo.",
                text_it: "si è unita alla partita con 1 amico."
            },
            "player_left_man": {
                text: "a quitté le match.",
                text_en: "left the game.",
                text_es: "se salió del juego.",
                text_it: "si è tolto dalla partita."
            },
            "player_left_man_plus_1": {
                text: "a quitté le match avec un ami.",
                text_en: "left the game with 1 friend.",
                text_es: "se salió del juego con 1 amigo.",
                text_it: "si è tolto dalla partita con 1 amico."
            },
            "player_left_man_plus_2": {
                text: "a quitté le match avec 2 amis.",
                text_en: "left the game with 2 friends.",
                text_es: "se salió del juego con 2 amigos.",
                text_it: "si è tolto dalla partita con 2 amici."
            },
            "player_left_man_plus_3": {
                text: "a quitté le match avec 3 amis.",
                text_en: "left the game with 3 friends.",
                text_es: "se salió del juego con 3 amigos.",
                text_it: "si è tolto dalla partita con 3 amici."
            },
            "player_left_man_plus_4": {
                text: "a quitté le match avec 4 amis.",
                text_en: "left the game with 4 friends.",
                text_es: "se salió del juego con 4 amigos.",
                text_it: "si è tolto dalla partita con 4 amici."
            },
            "player_left_woman": {
                text: "a quitté le match.",
                text_en: "left the game.",
                text_es: "se salió del juego.",
                text_it: "si è tolta dalla partita."
            },
            "player_left_woman_plus_1": {
                text: "a quitté le match avec un ami.",
                text_en: "left the game with 1 friend.",
                text_es: "se salió del juego con 1 amigo.",
                text_it: "si è tolta dalla partita con 1 amico."
            },
            "player_left_woman_plus_2": {
                text: "a quitté le match avec 2 amis.",
                text_en: "left the game with 2 friends.",
                text_es: "se salió del juego con 2 amigos.",
                text_it: "si è tolta dalla partita con 2 amici."
            },
            "player_left_woman_plus_3": {
                text: "a quitté le match avec 3 amis.",
                text_en: "left the game with 3 friends.",
                text_es: "se salió del juego con 3 amigos.",
                text_it: "si è tolta dalla partita con 3 amici."
            },
            "player_left_woman_plus_4": {
                text: "a quitté le match avec 4 amis.",
                text_en: "left the game with 4 friends.",
                text_es: "se salió del juego con 4 amigos.",
                text_it: "si è tolta dalla partita con 4 amici."
            }
        };

        const translations = translationMapping[trigger];

        if (translations) {
            await snap.ref.update(translations);
        }

        return null;
    });