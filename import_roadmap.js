const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const updateRoadmapDocuments = async () => {
    const roadmapCollection = db.collection('roadmap');
    const documents = [
        {
            id: "01ddyUI9Fz0Di6Ajkrxd",
            title_es: "Agregar un campo no referenciado",
            description_es: "Hoy, mostramos todos los centros y campos que Google conoce (es decir, la gran mayoría de los campos). También podríamos permitirte agregar uno en la dirección de tu elección.",
            title_it: "Aggiungi un campo non referenziato",
            description_it: "Oggi, mostriamo tutti i centri e i campi che Google conosce (cioè la stragrande maggioranza dei campi). Potremmo anche permetterti di aggiungerne uno all'indirizzo che preferisci."
        },
        {
            id: "33rRH5IM9ZIEYp1dpAd5",
            title_es: "Eliminar jugador de mi partido",
            description_es: "Como organizador, elimina a un jugador si es necesario.",
            title_it: "Rimuovi giocatore dalla mia partita",
            description_it: "Come organizzatore, rimuovi un giocatore se necessario."
        },
        {
            id: "48R2LW8THRUuIn7iyOc5",
            title_es: "Calificar la actitud de los jugadores",
            title_it: "Valuta l'atteggiamento dei giocatori"
        },
        {
            id: "4EsKKrlTW7PSCinrFfxA",
            title_es: "Cambiar el radio de ubicación",
            description_es: "Hoy, mostramos partidos que se realizan dentro de un radio de 30 km alrededor de la ciudad que has seleccionado.",
            title_it: "Cambia il raggio di posizione",
            description_it: "Oggi, mostriamo partite che si svolgono entro un raggio di 30 km intorno alla città che hai selezionato."
        },
        {
            id: "4Qg4hxSxzCUdok8XaoAG",
            title_es: "Filtrar por nivel",
            description_es: "Mostrar solo partidos de cierto nivel.",
            title_it: "Filtra per livello",
            description_it: "Mostra solo partite di un certo livello."
        },
        {
            id: "6yTcXuZOi3ua7JfBKIf7",
            title_es: "Repetir un partido anterior",
            description_es: "Después de un partido que has jugado, organiza la revancha en solo unos clics.",
            title_it: "Ripeti una partita precedente",
            description_it: "Dopo una partita che hai giocato, organizza il ritorno in pochi clic."
        },
        {
            id: "8ZcDLcz1tL2DaMnolVip",
            title_es: "Marcar un partido como reservado para mujeres",
            description_es: "Solo jugadoras podrían unirse.",
            title_it: "Segna una partita come riservata alle donne",
            description_it: "Solo le giocatrici potrebbero unirsi."
        },
        {
            id: "At1sqDtCBNajX9w7gJVZ",
            title_es: "Mostrar mi nivel de fútbol en mi perfil",
            title_it: "Mostra il mio livello di calcio nel mio profilo"
        },
        {
            id: "CYAJloUOzwe0k7ruvWJv",
            title_es: "Invitar a mis amigos a mi partido",
            description_es: "Enviar invitaciones, ver invitaciones pendientes…",
            title_it: "Invita i miei amici alla mia partita",
            description_it: "Invia inviti, vedi inviti in sospeso…"
        },
        {
            id: "DOF6ZXwDByeatIMAFgiE",
            title_es: "Filtrar por estado de ánimo",
            description_es: "Mostrar solo partidos casuales o competitivos.",
            title_it: "Filtra per umore",
            description_it: "Mostra solo partite casuali o competitive."
        },
        {
            id: "DquISxwr51PqwY1zAF4Z",
            title_es: "Acceder a mi lista de usuarios bloqueados",
            description_es: "Podrías desbloquear a usuarios que quisiste bloquear temporalmente.",
            title_it: "Accedi alla mia lista di utenti bloccati",
            description_it: "Potresti sbloccare gli utenti che volevi bloccare temporaneamente."
        },
        {
            id: "FeMYtF2PlHc3XuLa0SLg",
            title_es: "Declarar tardanza y ausencia",
            title_it: "Dichiarare ritardo e assenza"
        },
        {
            id: "GmhBS7aXoHG9x7T5iovF",
            title_es: "Construir mi equipo",
            description_es: "Selecciona a los amigos con los que juegas a menudo y crea tu equipo.",
            title_it: "Costruisci la mia squadra",
            description_it: "Seleziona gli amici con cui giochi spesso e crea la tua squadra."
        },
        {
            id: "Lgyamm54xVoUJLWNpRad",
            title_es: "Ganar puntos y recompensas por partidos jugados",
            title_it: "Guadagna punti e ricompense per le partite giocate"
        },
        {
            id: "NlcJbmdSXQrt0K7zhzyY",
            title_es: "Filtrar por número de plazas libres",
            description_es: "Mostrar solo partidos con un cierto número de plazas disponibles.",
            title_it: "Filtra per numero di posti liberi",
            description_it: "Mostra solo partite con un certo numero di posti disponibili."
        },
        {
            id: "OLgMLYmsMdRhk0iKdHv6",
            title_es: "Ver el número de personas que eligieron tu centro como favorito",
            description_es: "Dar a los jugadores la opción de seleccionar tu centro como su centro favorito, y ver cuántos clientes han seguido tu centro.",
            title_it: "Vedi il numero di persone che hanno scelto il tuo centro come preferito",
            description_it: "Dai ai giocatori la possibilità di scegliere il tuo centro come centro preferito e vedi quanti clienti hanno seguito il tuo centro."
        },
        {
            id: "PHF3q7K7IfW2ERN6l7qL",
            title_es: "Mostrar mi @ de Instagram en mi perfil",
            title_it: "Mostra il mio @ di Instagram nel mio profilo"
        },
        {
            id: "PJaXljvppE6I0vApdqxr",
            title_es: "Enviar correos a mis clientes en Poteau Pro",
            description_es: "Contacta fácilmente a tus clientes desde tu aplicación Poteau Pro.",
            title_it: "Invia email ai miei clienti su Poteau Pro",
            description_it: "Contatta facilmente i tuoi clienti dalla tua applicazione Poteau Pro."
        },
        {
            id: "Q1rHqQIdGm7rI44AhJmq",
            title_es: "Aumentar el tamaño del partido",
            description_es: "Pasa de 5v5 a 6v6, 7v7, 8v8… (ya entiendes)",
            title_it: "Aumenta la dimensione della partita",
            description_it: "Passa da 5v5 a 6v6, 7v7, 8v8… (hai capito)"
        },
        {
            id: "UiSmkfOXi79VwhWegbnn",
            title_es: "Hablar con mis jugadores desde la aplicación",
            description_es: "¿Te gustaría publicar actualizaciones desde la aplicación? Ofertas especiales, nuevos horarios de apertura…",
            title_it: "Parla con i miei giocatori dall'app",
            description_it: "Vorresti pubblicare aggiornamenti dall'app? Offerte speciali, nuovi orari di apertura…"
        },
        {
            id: "Wn1pg3ZNUB7MHq2xlRE5",
            title_es: "Pedir equipo publicitario de Poteau Pro",
            description_es: "Recibe carteles, folletos, camisetas, etc. con los colores de Poteau.",
            title_it: "Ordina attrezzature pubblicitarie di Poteau Pro",
            description_it: "Ricevi poster, volantini, magliette, ecc. nei colori di Poteau."
        },
        {
            id: "Xvu6EGS02ESMatMGNcMo",
            title_es: "Obligar a los que cancelan en el último minuto a explicar",
            description_es: "Un inconveniente puede suceder. Pero irse sin explicar/disculparse es realmente lamentable.",
            title_it: "Obbliga chi annulla all'ultimo minuto a spiegare",
            description_it: "Un inconveniente può capitare. Ma andarsene senza spiegare/chiedere scusa è davvero triste."
        },
        {
            id: "YHGzuQKTpiFeaSw44aVE",
            title_it: "Filtra per centro",
            description_it: "Mostra solo partite dai tuoi centri preferiti."
        },
        {
            id: "e9FOmEYuDlQ6kgjlx6Xg",
            title_es: "Configurar mi partido como privado",
            description_es: "Asegúrate de que solo tus amigos y jugadores invitados puedan ver tu partido.",
            title_it: "Imposta la mia partita come privata",
            description_it: "Assicurati che solo i tuoi amici e i giocatori invitati possano vedere la tua partita."
        },
        {
            id: "fQAQTW3f1aIuoIX5pavn",
            title_es: "Mostrar mi @de Snapchat en mi perfil",
            title_it: "Mostra il mio @di Snapchat nel mio profilo"
        },
        {
            id: "fhPgNVRbiFFk9jD4X0fk",
            title_es: "Agregar amigos desde mis contactos",
            description_es: "Encuentra y agrega amigos que ya han descargado Poteau.",
            title_it: "Aggiungi amici dai miei contatti",
            description_it: "Trova e aggiungi amici che hanno già scaricato Poteau."
        },
        {
            id: "fkKZPDObSGNNi3vGFyy0",
            title_es: "Filtrar por precio",
            description_es: "Mostrar solo partidos por debajo de cierto precio.",
            title_it: "Filtra per prezzo",
            description_it: "Mostra solo partite al di sotto di un certo prezzo."
        },
        {
            id: "gjJsIY5tRAwzC5ZX4Cd1",
            title_es: "Obtener estadísticas del rendimiento de mi centro en Poteau Pro",
            description_es: "Ve fácilmente los ingresos generados por Poteau para tu centro.",
            title_it: "Ottieni statistiche sulle prestazioni del mio centro su Poteau Pro",
            description_it: "Vedi facilmente i ricavi generati da Poteau per il tuo centro."
        },
        {
            id: "gsoT4IF1AggBw2x0jbvw",
            title_es: "Marcar el campo como reservado para un partido en Poteau Pro",
            description_es: "Marca cuando reservas el campo para un partido organizado en Poteau Pro.",
            title_it: "Segna il campo come prenotato per una partita su Poteau Pro",
            description_it: "Segna quando prenoti il campo per una partita organizzata su Poteau Pro."
        },
        {
            id: "j4qwYnKuyIVfSyXMsvzp",
            title_es: "Mencionar si el campo es interior o exterior",
            description_es: "Informa a tus jugadores si su campo es exterior o cubierto.",
            title_it: "Indica se il campo è interno o esterno",
            description_it: "Informa i tuoi giocatori se il campo è all\"aperto o coperto."
        },
        {
            id: "jHe2v35crYksKENBPbIu",
            title_es: "Programar torneos",
            description_es: "Crear torneos(varias horas, varios campos…) en Poteau Pro.",
            title_it: "Programma tornei",
            description_it: "Crea tornei(più ore, più campi…) su Poteau Pro."
        },
        {
            id: "jad9cfSJWV4Y1JMD2FlX",
            title_es: "Generar composición de equipo según el nivel",
            description_es: "En un partido, genera equipos aleatoriamente o según los niveles de habilidad de los jugadores para asegurar el equilibrio.",
            title_it: "Genera la composizione della squadra in base al livello",
            description_it: "In una partita, genera squadre casualmente o in base ai livelli di abilità dei giocatori per garantire l\"equilibrio."
        },
        {
            id: "kaH441xDequURWtvIPHK",
            title_es: "Chatear con alguien de mi equipo en Poteau",
            title_it: "Chatta con qualcuno della mia squadra su Poteau"
        },
        {
            id: "lzoROHrk6del9wODZTZk",
            title_es: "Mostrar mi @de X(ex - Twitter) en mi perfil",
            title_it: "Mostra il mio @di X(ex - Twitter) nel mio profilo"
        },
        {
            id: "o4rDBLMYGZFEvIreDFLR",
            title_es: "Tener un centro de notificaciones",
            description_es: "Si te gustaría acceder a un lugar en la aplicación para encontrar todas tus notificaciones.",
            title_it: "Avere un centro notifiche",
            description_it: "Se ti piacerebbe accedere a un posto nell\"app per trovare tutte le tue notifiche."
        },
        {
            id: "q9vK9nQrZvOJKtQD5AqW",
            title_es: "Sugerir nuevas personas para agregar según mis amigos",
            description_es: "Descubre nuevos amigos según los amigos que tienes hoy.",
            title_it: "Suggerisci nuove persone da aggiungere in base ai miei amici",
            description_it: "Scopri nuovi amici in base agli amici che hai oggi."
        },
        {
            id: "tQhUlARslCslsfBZJyV1",
            title_es: "Publicar una búsqueda de algunos jugadores para ayudar a un cliente",
            description_es: "Crea un partido para 1 a 3 jugadores para un cliente que no tiene la aplicación de Poteau.",
            title_it: "Pubblica una ricerca di alcuni giocatori per aiutare un cliente",
            description_it: "Crea una partita per 1 a 3 giocatori per un cliente che non ha l\"app Poteau."
        },
        {
            id: "v1wZbe09qtNXAnZjEa2k",
            title_es: "Ver a todos los jugadores que se han unido al partido",
            description_es: "En lugar de ver \"+ 3 amigos\", podríamos hacer que cada jugador se una al partido con su propio nombre.",
            title_it: "Vedi tutti i giocatori che si sono uniti alla partita",
            description_it: "Invece di vedere \"+ 3 amici\", potremmo fare in modo che ogni giocatore si unisca alla partita con il proprio nome."
        },
        {
            id: "yUZvwEcplJE2ZQpsg2bD",
            title_es: "Agregar varios usuarios a tu cuenta de Poteau Pro",
            description_es: "Crea una cuenta para cada miembro del equipo de tu centro, en lugar de una cuenta compartida del centro para todos.",
            title_it: "Aggiungi più utenti al tuo account Poteau Pro",
            description_it: "Crea un account per ogni membro della squadra del tuo centro, piuttosto che un account condiviso del centro per tutti."
        }
    ];

    for (const doc of documents) {
        const docRef = roadmapCollection.doc(doc.id);

        const updateData = {};

        // Update only if the fields are not empty
        if (doc.title_es) updateData.title_es = doc.title_es;
        if (doc.description_es) updateData.description_es = doc.description_es;
        if (doc.title_it) updateData.title_it = doc.title_it;
        if (doc.description_it) updateData.description_it = doc.description_it;

        await docRef.update(updateData);
        console.log(`Updated document ${doc.id}`);
    }
};

updateRoadmapDocuments()
    .then(() => {
        console.log('All documents updated successfully');
    })
    .catch((error) => {
        console.error('Error updating documents:', error);
    });