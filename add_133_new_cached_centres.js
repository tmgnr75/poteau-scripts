const admin = require('firebase-admin');

const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');
const fs = require('fs');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});


// Function to add documents to the "cached_centres" collection
async function addDocumentsToCachedCentres() {
    try {
        const db = admin.firestore();
        const batch = db.batch();

        const centreData = [
            { centre_name: "7 & Match Mondragon", centre_place_id: "ChIJPa2mELahtRIRikXKS6RPLqI", centre_location: new admin.firestore.GeoPoint(44.2592, 4.706397) },
            { centre_name: "All Five Codognan", centre_place_id: "ChIJ11ma8IIntBIRZR-K6mKJt68", centre_location: new admin.firestore.GeoPoint(43.728768, 4.2130881) },
            { centre_name: "Angers SCO Footsal", centre_place_id: "ChIJJXOtQ3d5CEgR5gqmLBWjkK4", centre_location: new admin.firestore.GeoPoint(47.4598867, -0.5293736) },
            { centre_name: "ARENA 18 Caudan", centre_place_id: "ChIJZ79NO6deEEgRVJrNAlg8mQs", centre_location: new admin.firestore.GeoPoint(47.781178, -3.3327791) },
            { centre_name: "Arena 5", centre_place_id: "ChIJE8mb-Dow4EcRP3o5L88W8y4", centre_location: new admin.firestore.GeoPoint(49.5003798, 0.1900191) },
            { centre_name: "Arena Club", centre_place_id: "ChIJeWJWRjYvw0cRbnJR4ZXAKMA", centre_location: new admin.firestore.GeoPoint(50.7696017, 3.1236104) },
            { centre_name: "Arena Foot Béziers", centre_place_id: "ChIJ33melwQPsRIRJ7UFX-Rd8FM", centre_location: new admin.firestore.GeoPoint(43.3221702, 3.1861007) },
            { centre_name: "AU FIVE Saint Raphaël", centre_place_id: "ChIJAQCwb4KXzhIRdJFsgoCRJyE", centre_location: new admin.firestore.GeoPoint(43.4292109, 6.789112800000001) },
            { centre_name: "B14 - Sports et Loisirs Indoor", centre_place_id: "ChIJaeLKMYXe5UcRHyWJ8X8FaPA", centre_location: new admin.firestore.GeoPoint(48.62229, 2.3800445) },
            { centre_name: "BALL CONCEPT Monplaisir", centre_place_id: "ChIJn7xJyorytRIR5fCxB3seBOs", centre_location: new admin.firestore.GeoPoint(43.9521998, 4.8707766) },
            { centre_name: "Ball In d'Or Dreux", centre_place_id: "ChIJgRwhLzZV4UcRZ1kZ41ivPqU", centre_location: new admin.firestore.GeoPoint(48.7468231, 1.3611978) },
            { centre_name: "BIG5", centre_place_id: "ChIJsb_7TJFp5kcRSPL5VqZulr4", centre_location: new admin.firestore.GeoPoint(48.9901429, 2.3617895) },
            { centre_name: "Bordeaux Soccer", centre_place_id: "ChIJCRHQufUoVQ0RmXgf8oHOE08", centre_location: new admin.firestore.GeoPoint(44.8710961, -0.5620394) },
            { centre_name: "Breizh Soccer", centre_place_id: "ChIJFUMBTCUZEEgRd1d648O0VI0", centre_location: new admin.firestore.GeoPoint(47.68108669999999, -2.8025865) },
            { centre_name: "Cannes Soccer 5", centre_place_id: "ChIJ5dAPFv-CzhIRJx0DImYM_cc", centre_location: new admin.firestore.GeoPoint(43.544355, 6.962017899999999) },
            { centre_name: "Champions Five", centre_place_id: "ChIJX7pTGkosi0cR22J6MKLnxdw", centre_location: new admin.firestore.GeoPoint(45.58942150000001, 5.249078799999999) },
            { centre_name: "Classico Foot", centre_place_id: "ChIJFV442oCxrhIRgsZy5aIbkNs", centre_location: new admin.firestore.GeoPoint(43.5945434, 1.2911399) },
            { centre_name: "DK Park / LE FIVE Dunkerque", centre_place_id: "ChIJj70TyWiL3EcR7iZ1fa-JRNk", centre_location: new admin.firestore.GeoPoint(51.01440059999999, 2.3477199) },
            { centre_name: "EFIVE Avignon Vedene", centre_place_id: "ChIJd-UEcsXztRIRA9jWoQe2RtU", centre_location: new admin.firestore.GeoPoint(43.97166319999999, 4.894042) },
            { centre_name: "Events Five", centre_place_id: "ChIJf8cSCJG5rhIRoQadPH-wW1U", centre_location: new admin.firestore.GeoPoint(43.5399703, 1.3922897) },
            { centre_name: "Evolution Football", centre_place_id: "ChIJX0YulIi8yRIRnGh62u3UXTQ", centre_location: new admin.firestore.GeoPoint(43.2836074, 5.52356) },
            { centre_name: "F5 Foot Five", centre_place_id: "ChIJjUbM5G7A9EcRW3mlkrhyXxY", centre_location: new admin.firestore.GeoPoint(45.7857911, 4.905926399999999) },
            { centre_name: "Factory Sport Games", centre_place_id: "ChIJNcDntQGO9EcR3CbXF7xfc5o", centre_location: new admin.firestore.GeoPoint(45.8874393, 4.7216857) },
            { centre_name: "Firefoot", centre_place_id: "ChIJ0zSROfj15kcR4l0wrCcYPMk", centre_location: new admin.firestore.GeoPoint(49.0275342, 2.1040185) },
            { centre_name: "Fit'n Soccer Sedan", centre_place_id: "ChIJfWQYaM9v6kcR5wfQjFQqpv4", centre_location: new admin.firestore.GeoPoint(49.6973533, 4.918232600000001) },
            { centre_name: "Five Factory Le Havre", centre_place_id: "ChIJk-ujvdYv4EcRXoLCtLvjW7I", centre_location: new admin.firestore.GeoPoint(49.4930667, 0.1707863) },
            { centre_name: "Foot à 5 @ Le club le Village", centre_place_id: "ChIJwU28MyyB5kcRHVcpV1mkYVo", centre_location: new admin.firestore.GeoPoint(48.766805, 2.026255) },
            { centre_name: "Foot Indoor Limay", centre_place_id: "ChIJAQDAMXiV5kcRrL5fPp5Dj7g", centre_location: new admin.firestore.GeoPoint(48.9895331, 1.7603096) },
            { centre_name: "FOOT INDOOR Marseille", centre_place_id: "ChIJ41AMCxC8yRIRLHLGt11sc-U", centre_location: new admin.firestore.GeoPoint(43.2859688, 5.4882746) },
            { centre_name: "Foot&Balls", centre_place_id: "ChIJrd55eqy9_UcRafBnS1pNdaU", centre_location: new admin.firestore.GeoPoint(46.6244345, 0.353363) },
            { centre_name: "Football 5 Club Rosny", centre_place_id: "ChIJTcHVp4S55kcRUD4Mh5Pro98", centre_location: new admin.firestore.GeoPoint(48.994969, 1.648947) },
            { centre_name: "Footiball Arles", centre_place_id: "ChIJ-eisyafYtRIRV-06tEm2VTo", centre_location: new admin.firestore.GeoPoint(43.6990926, 4.6335339) },
            { centre_name: "FOOTMAX Saint-Maximin", centre_place_id: "ChIJJazitpdJ5kcRIN9wK_jwKUY", centre_location: new admin.firestore.GeoPoint(49.2391128, 2.4577023) },
            { centre_name: "Footsal", centre_place_id: "ChIJa7HS298pw0cRMoVDj0XqVdI", centre_location: new admin.firestore.GeoPoint(50.6397895, 3.1251337) },
            { centre_name: "Footsall Omnisports Mâcon", centre_place_id: "ChIJGfUohl5u80cRkNdhfgbvDA0", centre_location: new admin.firestore.GeoPoint(46.3151371, 4.832474299999999) },
            { centre_name: "Fun Foot Ajaccio", centre_place_id: "ChIJMYDG2oxr2hIR2VIfssGUycU", centre_location: new admin.firestore.GeoPoint(41.9558805, 8.7816756) },
            { centre_name: "Game 13 foot indoor", centre_place_id: "ChIJNSDvlsXryRIRUXao9hwB79I", centre_location: new admin.firestore.GeoPoint(43.41258939999999, 5.366617) },
            { centre_name: "Garden Soccer", centre_place_id: "ChIJB1Epk28EyRIRXiphlsMqnOU", centre_location: new admin.firestore.GeoPoint(43.1142128, 5.8451366) },
            { centre_name: "GFC Foot Indoor Mulhouse", centre_place_id: "ChIJofRGnUSbkUcRzYQUtJAexeE", centre_location: new admin.firestore.GeoPoint(47.7566418, 7.313073300000001) },
            { centre_name: "GINGA Foot Mérignac", centre_place_id: "ChIJyfJZiyPaVA0RlY6_mDcql7U", centre_location: new admin.firestore.GeoPoint(44.81810309999999, -0.678014) },
            { centre_name: "Goal In d'Or La Farlède", centre_place_id: "ChIJHT4IIT8YyRIREI_EDEAf9gE", centre_location: new admin.firestore.GeoPoint(43.1531426, 6.042328100000001) },
            { centre_name: "GOPARK INTERIEUR - Paintball et trampolines parc", centre_place_id: "ChIJ2cJmdhf15kcRQ4mUOxIVzd0", centre_location: new admin.firestore.GeoPoint(49.045624, 2.0799886) },
            { centre_name: "Insport Montpellier - Près d'arènes", centre_place_id: "ChIJJWIca-qvthIRHxcGJpAq4kA", centre_location: new admin.firestore.GeoPoint(43.5867499, 3.8863806) },
            { centre_name: "Kaiser Park", centre_place_id: "ChIJsRLZzKFg5kcRBCfNws9nssw", centre_location: new admin.firestore.GeoPoint(49.0175545, 2.1775301) },
            { centre_name: "KG5 Strasbourg-Mundolsheim", centre_place_id: "ChIJRSG64gm4lkcRPQTZbn3M85Q", centre_location: new admin.firestore.GeoPoint(48.6354584, 7.724195300000001) },
            { centre_name: "KIPSTADIUM", centre_place_id: "ChIJydcoT88ow0cRLnHvlF-Z_jE", centre_location: new admin.firestore.GeoPoint(50.7085083, 3.1733057) },
            { centre_name: "L'Arène Chartres", centre_place_id: "ChIJRaMGi5gN5EcR_sqZitCqLPY", centre_location: new admin.firestore.GeoPoint(48.4251475, 1.4542319) },
            { centre_name: "L'ÉTINCELLE Sélestat", centre_place_id: "ChIemIPT3S7dEkcRHYSOAnApZaA", centre_location: new admin.firestore.GeoPoint(48.2537206, 7.4311337) },
            { centre_name: "Le 13 - Foot en salle - Marseille", centre_place_id: "ChIJR62kUm_ByRIRDnGQqGCeUVQ", centre_location: new admin.firestore.GeoPoint(43.33370070000001, 5.370389599999999) },
            { centre_name: "LE 5 DE LEGENDE", centre_place_id: "ChIJAQNaA3nc9EcRYvB35x41mBs", centre_location: new admin.firestore.GeoPoint(45.7617542, 4.9413708) },
            { centre_name: "Le B3 Soccer", centre_place_id: "ChIJa69uraDryRIRRlY7a07cUqU", centre_location: new admin.firestore.GeoPoint(43.4263643, 5.365863600000001) },
            { centre_name: "Le Classico 70 Héricourt", centre_place_id: "ChIJwdVDuwo-kkcR5rIoryU9p4k", centre_location: new admin.firestore.GeoPoint(47.5826352, 6.775028) },
            { centre_name: "Le Complexe Manosque", centre_place_id: "ChIJ33wx0UrMyxIRabB0hcTFAz0", centre_location: new admin.firestore.GeoPoint(43.8017659, 5.8105408) },
            { centre_name: "LE COMPLEXE Salon-de-Provence", centre_place_id: "ChIJZdrYy1D-yRIRrrlLXLwuv5Y", centre_location: new admin.firestore.GeoPoint(43.6310619, 5.0960468) },
            { centre_name: "Le CR5", centre_place_id: "ChIJnVE47IHn5UcRr5XRwCaPE38", centre_location: new admin.firestore.GeoPoint(48.5655349, 2.4533388) },
            { centre_name: "LE FIVE Annemasse", centre_place_id: "ChIJVc4JI-FtjEcRkBpWIDCVoII", centre_location: new admin.firestore.GeoPoint(46.206535, 6.280475) },
            { centre_name: "LE FIVE Colomiers", centre_place_id: "ChIJ8wxhgGexrhIRm698kMPQIRw", centre_location: new admin.firestore.GeoPoint(43.6189694, 1.3434047) },
            { centre_name: "LE FIVE La Rochelle", centre_place_id: "ChIJAYcXu5xNAUgRiFOwJiUbggQ", centre_location: new admin.firestore.GeoPoint(46.16183179999999, -1.0915968) },
            { centre_name: "LE FIVE Lens-Liévin", centre_place_id: "ChIJ291icE063UcR1gWGn8xhzpw", centre_location: new admin.firestore.GeoPoint(50.429107, 2.742526) },
            { centre_name: "LE FIVE Metz", centre_place_id: "ChIJodpwmbLblEcRGk4-_FQorf4", centre_location: new admin.firestore.GeoPoint(49.0861769, 6.1183378) },
            { centre_name: "LE FIVE Mulhouse", centre_place_id: "ChIJ-eyETc2ckUcRBWEN6LGV_u0", centre_location: new admin.firestore.GeoPoint(47.7960233, 7.3050341) },
            { centre_name: "LE FIVE Nancy", centre_place_id: "ChIJ84QrCMaYlEcRF5c_hb5H97c", centre_location: new admin.firestore.GeoPoint(48.6450904, 6.189443) },
            { centre_name: "LE FIVE Orléans Fleury", centre_place_id: "ChIJsYfwe3n75EcRnjpH9sw356Q", centre_location: new admin.firestore.GeoPoint(47.9415754, 1.9358176) },
            { centre_name: "LE FIVE Orléans Ingré", centre_place_id: "ChIJzUFPDv_v5EcRG6gmhm_t_HA", centre_location: new admin.firestore.GeoPoint(47.9057474, 1.8536754) },
            { centre_name: "LE FIVE Reims", centre_place_id: "ChIJad8c0qR16UcRMPDMaa34XJ8", centre_location: new admin.firestore.GeoPoint(49.2687603, 4.0383523) },
            { centre_name: "LE FIVE Rouen", centre_place_id: "ChIc7ot9ESvGhIRqni6q0J6B4fY", centre_location: new admin.firestore.GeoPoint(49.4276596, 1.1038652) },
            { centre_name: "LE FIVE Saint-Louis - Bâle", centre_place_id: "ChIJa9Anja27kUcRNXt6NgUDdmY", centre_location: new admin.firestore.GeoPoint(47.6019391, 7.5448664) },
            { centre_name: "LE FIVE Saint-Louis La Réunion", centre_place_id: "ChIJMZT87I2ggiERx46yqMI-es4", centre_location: new admin.firestore.GeoPoint(-21.2902719, 55.39892039999999) },
            { centre_name: "LE FIVE Strasbourg", centre_place_id: "ChIJ934qQbG3lkcRm6TibMl6fgg", centre_location: new admin.firestore.GeoPoint(48.5899458, 7.680286100000001) },
            { centre_name: "LE FIVE Valenciennes", centre_place_id: "ChIJs_yKhaPvwkcRtt71kMRaz8A", centre_location: new admin.firestore.GeoPoint(50.3821465, 3.4713322) },
            { centre_name: "Le Klube Dijon", centre_place_id: "ChIJ8Tuh1mpi7UcRwv5WsRCd1fc", centre_location: new admin.firestore.GeoPoint(47.3564016, 5.0383111) },
            { centre_name: "Le Mercato FOOT INDOOR", centre_place_id: "ChIJzRK7HJy_yRIRqEreyEiAfC0", centre_location: new admin.firestore.GeoPoint(43.3426654, 5.4084961) },
            { centre_name: "LE PARK Complexe Multisports", centre_place_id: "ChIJMU8gErUJ5kcRSnpvacKwFtM", centre_location: new admin.firestore.GeoPoint(48.71189589999999, 2.5771181) },
            { centre_name: "Le Smile Sautron", centre_place_id: "ChIJ9Wv9FbuTBUgRQNYd2r8vvrI", centre_location: new admin.firestore.GeoPoint(47.2518597, -1.6574509) },
            { centre_name: "Le Sporting Nantes", centre_place_id: "ChIJo-3LeLXsBUgRu6gtAgQ6sJA", centre_location: new admin.firestore.GeoPoint(47.2215137, -1.6415682) },
            { centre_name: "Le Stadium Compiègne", centre_place_id: "ChIJDX03WfbX50cR_4gqKIFvcqk", centre_location: new admin.firestore.GeoPoint(49.427907, 2.849432) },
            { centre_name: "Le Temple du Foot", centre_place_id: "ChIJX6tTCaTg4EcREj-uKrMtLMc", centre_location: new admin.firestore.GeoPoint(49.426831, 1.0517861) },
            { centre_name: "Le Temple FIVE Center", centre_place_id: "ChIJvcCWluNtsBIRYScZxAbEtxQ", centre_location: new admin.firestore.GeoPoint(42.6851653, 2.8541333) },
            { centre_name: "LIGUA FIVE Saint-Brevin", centre_place_id: "ChIJ_____yNwBUgRSG7Jc1nxPmY", centre_location: new admin.firestore.GeoPoint(47.2318916, -2.1496915) },
            { centre_name: "Massilia FIVE", centre_place_id: "ChIJxZ6UmMW-yRIRfYNGGPPJfIU", centre_location: new admin.firestore.GeoPoint(43.28920790000001, 5.4503802) },
            { centre_name: "Massilia Foot Indoor 2", centre_place_id: "ChIJxZ6UmMW-yRIRfYNGGPPJfIU", centre_location: new admin.firestore.GeoPoint(43.3266563, 5.3836488) },
            { centre_name: "MONCLUB 2.0", centre_place_id: "ChIJv9owGLm-yRIRfuDnd3G6nR4", centre_location: new admin.firestore.GeoPoint(43.2895156, 5.4611522) },
            { centre_name: "Mondial Soccer Martigues", centre_place_id: "ChIJxSxBZ0rmyRIRD43lI6mPqdE", centre_location: new admin.firestore.GeoPoint(43.40826250000001, 5.0265179) },
            { centre_name: "OHSPORT", centre_place_id: "ChIJHeG9fA4X5kcRbGNzVY5Ud5I", centre_location: new admin.firestore.GeoPoint(48.9672396, 2.5670436) },
            { centre_name: "Olive et Tom Foot", centre_place_id: "ChIJM91frs_gyRIR0DmRNXYM0hc", centre_location: new admin.firestore.GeoPoint(43.3955137, 5.1351071) },
            { centre_name: "Padel and Foot Strasbourg", centre_place_id: "ChIJE9ZciNLHlkcRF9bBiXbLuYk", centre_location: new admin.firestore.GeoPoint(48.6273689, 7.769607499999998) },
            { centre_name: "Play Arena Besançon", centre_place_id: "ChIJ2xDqIaNjjUcRJPUt8jWX5zI", centre_location: new admin.firestore.GeoPoint(47.2364225, 5.9870613) },
            { centre_name: "Play Soccer", centre_place_id: "ChIJQ-UxZn-5rhIRKWoQydM5T9s", centre_location: new admin.firestore.GeoPoint(43.5512023, 1.4098927) },
            { centre_name: "Player 5M Bessan", centre_place_id: "ChIJKcIlfy4-sRIRQpnxhc225GU", centre_location: new admin.firestore.GeoPoint(43.373057, 3.4271789) },
            { centre_name: "Power Five", centre_place_id: "ChIJ6ULNmyh15kcRV9cjbnBjGr8", centre_location: new admin.firestore.GeoPoint(48.7301249, 2.4343214) },
            { centre_name: "S-FIVE5", centre_place_id: "ChIJqzie9xRL5kcRyg89AlwL55E", centre_location: new admin.firestore.GeoPoint(49.2732684, 2.4747214) },
            { centre_name: "Smash Goal Nantes", centre_place_id: "ChIJ2yg06abuBUgRixLY3NLRh14", centre_location: new admin.firestore.GeoPoint(47.249768, -1.5010788) },
            { centre_name: "Soccer Arena Manom", centre_place_id: "ChIeaIuWCc7lUcRhgvoCbAgwIc", centre_location: new admin.firestore.GeoPoint(49.2978099, 6.0440503) },
            { centre_name: "Soccer Rennais", centre_place_id: "ChIJBWiWc1HgDkgRnIHJ7R5SVU0", centre_location: new admin.firestore.GeoPoint(48.1003888, -1.7320165) },
            { centre_name: "Soccer Team Alès", centre_place_id: "ChIJk7CiF_xCtBIRIBZ_Q1ozEQg", centre_location: new admin.firestore.GeoPoint(44.1421138, 4.1065699) },
            { centre_name: "Sport dans la Ville Rhône-Alpes", centre_place_id: "ChIJoUEDcmvr9EcRILCz6hDCQ2o", centre_location: new admin.firestore.GeoPoint(45.7811703, 4.8081568) },
            { centre_name: "SPORT N DOOR Colmar", centre_place_id: "ChIJoTqB5CJmkUcRheYL3WcGzXo", centre_location: new admin.firestore.GeoPoint(48.1052207, 7.373677699999999) },
            { centre_name: "Sport4lux Munsbach", centre_place_id: "ChIJoTqB5CJmkUcRheYL3WcGzXo", centre_location: new admin.firestore.GeoPoint(49.6436457, 6.2721703) },
            { centre_name: "Sports and Play Lançon de Provence", centre_place_id: "ChIJN_Jhj3P9yRIRB_PmaXuccA0", centre_location: new admin.firestore.GeoPoint(43.5917175, 5.110592899999999) },
            { centre_name: "Spot FUTSAL", centre_place_id: "ChIJwdUawmfVwkcRaNLo_CmNii0", centre_location: new admin.firestore.GeoPoint(50.6106345, 3.0624494) },
            { centre_name: "Stadium FIVE Center Perpignan", centre_place_id: "ChIJK88_lR9wsBIRvGy5h9RQAaQ", centre_location: new admin.firestore.GeoPoint(42.6914386, 2.8492865) },
            { centre_name: "STADIUM FOOT 5 VILLAGE", centre_place_id: "ChIJbbOWFtC4yRIR0WXVerbWmnE", centre_location: new admin.firestore.GeoPoint(43.269413, 5.4260321) },
            { centre_name: "Sun Set Soccer", centre_place_id: "ChIJ-2jOt33D9EcRLZL2mS5Gvz4", centre_location: new admin.firestore.GeoPoint(45.6768927, 4.9409477) },
            { centre_name: "Teams5 Amiens", centre_place_id: "ChIJ-XZhNZeG50cRLANyhp056JE", centre_location: new admin.firestore.GeoPoint(49.9259492, 2.3011648) },
            { centre_name: "THE FIVE Tours", centre_place_id: "ChIJ_W2Q_SPV_EcRj3zLt_rpEw4", centre_location: new admin.firestore.GeoPoint(47.4324282, 0.6918124) },
            { centre_name: "THE SOC5CER - Montauban", centre_place_id: "ChIJUc4N5XYSrBIRidC7hrwrqJ0", centre_location: new admin.firestore.GeoPoint(44.0388804, 1.3716001) },
            { centre_name: "UrbanSoccer - Angers", centre_place_id: "ChIJBcOLHhJ_CEgRBi_FUHPvAQ0", centre_location: new admin.firestore.GeoPoint(47.472353, -0.6048954999999999) },
            { centre_name: "UrbanSoccer - Bordeaux Mérignac", centre_place_id: "ChIJxWBxmALaVA0Rop0OWS3Q3fY", centre_location: new admin.firestore.GeoPoint(44.825426, -0.6839708999999999) },
            { centre_name: "UrbanSoccer - Clermont Aubière", centre_place_id: "ChIJ96RKNVAc90cRD9SqpCA54CA", centre_location: new admin.firestore.GeoPoint(45.7550465, 3.1363437) },
            { centre_name: "UrbanSoccer - Dijon", centre_place_id: "ChIJT3z7m-Nh7UcRm7VB5bhK3d0", centre_location: new admin.firestore.GeoPoint(47.3404773, 5.0728491) },
            { centre_name: "UrbanSoccer - Grenoble", centre_place_id: "ChIJX6YWdrz1ikcRwdG7lUc49fg", centre_location: new admin.firestore.GeoPoint(45.2039795, 5.7734857) },
            { centre_name: "UrbanSoccer - Lille Bondues", centre_place_id: "ChIJ58ZerMgrw0cR2Jyp7tZjBn4", centre_location: new admin.firestore.GeoPoint(50.6913774, 3.0860264) },
            { centre_name: "UrbanSoccer - Lille Lezennes", centre_place_id: "ChIJR3ro5nTWwkcRfM_S3Be9HjI", centre_location: new admin.firestore.GeoPoint(50.6169533, 3.0995426) },
            { centre_name: "UrbanSoccer - Limoges", centre_place_id: "ChIJW6IzlEUz-UcRIlyS1lolmbc", centre_location: new admin.firestore.GeoPoint(45.8084631, 1.2586858) },
            { centre_name: "UrbanSoccer - Lyon Barolles", centre_place_id: "ChIJN4l-IC3v9EcRf9QJKIVC_aY", centre_location: new admin.firestore.GeoPoint(45.6837539, 4.7725939) },
            { centre_name: "UrbanSoccer - Lyon Parilly", centre_place_id: "ChIJx3FQWjLC9EcRrrQb2eV7i_4", centre_location: new admin.firestore.GeoPoint(45.7120399, 4.9039284) },
            { centre_name: "UrbanSoccer - Montpellier", centre_place_id: "ChIJVXFMq4ylthIRtrZPBHOMTAc", centre_location: new admin.firestore.GeoPoint(43.6287935, 3.9096721) },
            { centre_name: "UrbanSoccer - Nantes St-Sébastien", centre_place_id: "ChIJAyKrntzoBUgRF09hrORC2nc", centre_location: new admin.firestore.GeoPoint(47.1902798, -1.4846704) },
            { centre_name: "UrbanSoccer - Rennes Cap Malo", centre_place_id: "ChIJ-Ro0hr3nDkgRA0q2y4bBD30", centre_location: new admin.firestore.GeoPoint(48.20007469999999, -1.7233636) },
            { centre_name: "UrbanSoccer - Saint Etienne", centre_place_id: "ChIJ6xFIgPWr9UcRxo6t2gZwcZM", centre_location: new admin.firestore.GeoPoint(45.4615409, 4.3921188) },
            { centre_name: "UrbanSoccer - Strasbourg", centre_place_id: "ChIJbeF8CznIlkcRkTmqhGiUECc", centre_location: new admin.firestore.GeoPoint(48.5935464, 7.731737300000001) },
            { centre_name: "UrbanSoccer - Toulouse Montaudran", centre_place_id: "ChIJl772e0u8rhIR2foRX4Xa2CI", centre_location: new admin.firestore.GeoPoint(43.574642, 1.4801835) },
            { centre_name: "UrbanSoccer - Toulouse Sept Deniers", centre_place_id: "ChIJk5nUBdOkrhIRP-1aUJzo-lA", centre_location: new admin.firestore.GeoPoint(43.6321552, 1.411696) },
            { centre_name: "UrbanSoccer - Villeneuve Loubet", centre_place_id: "ChIJVVVVEU3TzRIRX9_gbFDSBj0", centre_location: new admin.firestore.GeoPoint(43.6614017, 7.095247199999999) },
            { centre_name: "UrbanSoccer Bordeaux-Pessac", centre_place_id: "ChIJTZ1wTCnZVA0Ra5hHoMEPn3I", centre_location: new admin.firestore.GeoPoint(44.7788147, -0.6443808) },
            { centre_name: "UrbanSoccer Le Mans", centre_place_id: "ChIJV4SAsGqP4kcRQZ1u_kOCHfc", centre_location: new admin.firestore.GeoPoint(47.96290399999999, 0.2185836) },
            { centre_name: "UrbanSoccer Nantes - Carquefou", centre_place_id: "ChIJEWyPupv7BUgRBqnhym4EyLk", centre_location: new admin.firestore.GeoPoint(47.2875443, -1.4802803) },
            { centre_name: "UrbanSoccer Rennes Vern", centre_place_id: "ChIJS5VW0FUnD0gRUd2xV2pEeKY", centre_location: new admin.firestore.GeoPoint(48.06725309999999, -1.6016538) },
            { centre_name: "VERSUSFOOT Thiais", centre_place_id: "ChIJn2R2NT905kcRjqB29qldBxk", centre_location: new admin.firestore.GeoPoint(48.7501009, 2.3802899) },
            { centre_name: "VSD39 Dole", centre_place_id: "ChIJeSnd96VNjUcRMB1eWaVkmKs", centre_location: new admin.firestore.GeoPoint(47.10255979999999, 5.5016487) },
            { centre_name: "We Are Sports", centre_place_id: "ChIJFZU5oBHC9EcRJTFrSkI1xxg", centre_location: new admin.firestore.GeoPoint(45.7113247, 4.8761886) },
            { centre_name: "Z5 Aix", centre_place_id: "ChIJKb-U_9KSyRIRKIFKbH5mW18", centre_location: new admin.firestore.GeoPoint(43.4787869, 5.3969048) },
            { centre_name: "Z5 Istres", centre_place_id: "ChIJg2T7dqcdthIRsQBEO9wiews", centre_location: new admin.firestore.GeoPoint(43.4755916, 4.9937654) }
        ];

        centreData.forEach((centre) => {
            const docRef = db.collection('cached_centres').doc(centre.centre_place_id);
            batch.set(docRef, centre);
        });

        await batch.commit();
        console.log('Documents successfully written to cached_centres collection.');
    } catch (error) {
        console.error('Error writing documents: ', error);
    }
}

addDocumentsToCachedCentres();
