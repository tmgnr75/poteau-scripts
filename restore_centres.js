const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

// Array containing the data to restore
const centreData = [
    {
        "centre_name": "Sun Set Soccer",
        "centre_place_id": "ChIJ-2jOt33D9EcRLZL2mS5Gvz4",
        "centre_location": "[45.6768927° N, 4.9409477° E]"
    },
    {
        "centre_name": "UrbanSoccer - Rennes Cap Malo",
        "centre_place_id": "ChIJ-Ro0hr3nDkgRA0q2y4bBD30",
        "centre_location": "[48.20007469999999° N, 1.7233636° W]"
    },
    {
        "centre_name": "Brooklyn Force Soccer",
        "centre_place_id": "ChIJ-S82HdRbwokRHcC6tN0__L4",
        "centre_location": "[40.68279960006237° N, 73.98573264418236° W]"
    },
    {
        "centre_name": "Teams5 Amiens",
        "centre_place_id": "ChIJ-XZhNZeG50cRLANyhp056JE",
        "centre_location": "[49.9259492° N, 2.3011648° E]"
    },
    {
        "centre_name": "Footiball Arles",
        "centre_place_id": "ChIJ-eisyafYtRIRV-06tEm2VTo",
        "centre_location": "[43.6990926° N, 4.6335339° E]"
    },
    {
        "centre_name": "LE FIVE Mulhouse",
        "centre_place_id": "ChIJ-eyETc2ckUcRBWEN6LGV_u0",
        "centre_location": "[47.7960233° N, 7.3050341° E]"
    },
    {
        "centre_name": "Urban Soccer 5 Center",
        "centre_place_id": "ChIJ-zWdGc7SwoARv4eN0GcHeyw",
        "centre_location": "[33.909868° N, 119.1336988° W]"
    },
    {
        "centre_name": "FIVE ARENA MEAUX",
        "centre_place_id": "ChIJ02bKSuih6EcRb796CXVbkVs",
        "centre_location": "[48.9539465° N, 2.9154573° E]"
    },
    {
        "centre_name": "UrbanSoccer Meudon",
        "centre_place_id": "ChIJ0WKvjbh75kcRoqSmyWwW2jQ",
        "centre_location": "[48.80013599999999° N, 2.2140811° E]"
    },
    {
        "centre_name": "UrbanSoccer - Porte d'Aubervilliers",
        "centre_place_id": "ChIJ0dXjDCZs5kcRvX0EpMwxsUY",
        "centre_location": "[48.9074912° N, 2.3746518° E]"
    },
    {
        "centre_name": "Firefoot",
        "centre_place_id": "ChIJ0zSROfj15kcR4l0wrCcYPMk",
        "centre_location": "[49.0275342° N, 2.1040185° E]"
    },
    {
        "centre_name": "All Five Codognan",
        "centre_place_id": "ChIJ11ma8IIntBIRZR-K6mKJt68",
        "centre_location": "[43.728768° N, 4.2130881° E]"
    },
    {
        "centre_name": "Soccer Center NYC",
        "centre_place_id": "ChIJ1aOw95RfwokRe0fEYMdtNJg",
        "centre_location": "[40.756478322625114° N, 73.92187277116352° W]"
    },
    {
        "centre_name": "Revolution Soccer Complex",
        "centre_place_id": "ChIJ1emlnUhL9IgRGZwtqD7Zz0k",
        "centre_location": "[29.99899318066411° N, 95.43933249801391° W]"
    },
    {
        "centre_name": "LE FIVE Lens-Liévin",
        "centre_place_id": "ChIJ291icE063UcR1gWGn8xhzpw",
        "centre_location": "[50.429107° N, 2.742526° E]"
    },
    {
        "centre_name": "GOPARK Pontoise",
        "centre_place_id": "ChIJ2cJmdhf15kcRQ4mUOxIVzd0",
        "centre_location": "[49.045624° N, 2.0799886° E]"
    },
    {
        "centre_name": "LE FIVE Marville - La Courneuve",
        "centre_place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY",
        "centre_location": "[48.9364404° N, 2.3869147° E]"
    },
    {
        "centre_name": "Play Arena Besançon",
        "centre_place_id": "ChIJ2xDqIaNjjUcRJPUt8jWX5zI",
        "centre_location": "[47.2364225° N, 5.9870613° E]"
    },
    {
        "centre_name": "Speed Soccer Five",
        "centre_place_id": "ChIJ2xTNglV25kcR3UDi4AXGfDU",
        "centre_location": "[48.7360598° N, 2.315058° E]"
    },
    {
        "centre_name": "Smash Goal Nantes",
        "centre_place_id": "ChIJ2yg06abuBUgRixLY3NLRh14",
        "centre_location": "[47.249768° N, 1.5010788° W]"
    },
    {
        "centre_name": "Arena Foot Béziers",
        "centre_place_id": "ChIJ33melwQPsRIRJ7UFX-Rd8FM",
        "centre_location": "[43.3221702° N, 3.1861007° E]"
    },
    {
        "centre_name": "Le Complexe Manosque",
        "centre_place_id": "ChIJ33wx0UrMyxIRabB0hcTFAz0",
        "centre_location": "[43.8017659° N, 5.8105408° E]"
    },
    {
        "centre_name": "FOOT INDOOR Marseille",
        "centre_place_id": "ChIJ41AMCxC8yRIRLHLGt11sc-U",
        "centre_location": "[43.2859688° N, 5.4882746° E]"
    },
    {
        "centre_name": "SOFIVE - COVINA",
        "centre_place_id": "ChIJ4Zh9okUpw4ARzt9_t2FR39Y",
        "centre_location": "[34.07784672915501° N, 117.881647398152° W]"
    },
    {
        "centre_name": "UrbanSoccer - Lille Bondues",
        "centre_place_id": "ChIJ58ZerMgrw0cR2Jyp7tZjBn4",
        "centre_location": "[50.6913774° N, 3.0860264° E]"
    },
    {
        "centre_name": "Socceroof LIC",
        "centre_place_id": "ChIJ5QHjQedfwokRcvhei27HV1o",
        "centre_location": "[40.754039° N, 73.9271867° W]"
    },
    {
        "centre_name": "Cannes Soccer 5",
        "centre_place_id": "ChIJ5dAPFv-CzhIRJx0DImYM_cc",
        "centre_location": "[43.544355° N, 6.962017899999999° E]"
    },
    {
        "centre_name": "Stadium Thiais",
        "centre_place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA",
        "centre_location": "[48.7511024° N, 2.3713455° E]"
    },
    {
        "centre_name": "Power Five",
        "centre_place_id": "ChIJ6ULNmyh15kcRV9cjbnBjGr8",
        "centre_location": "[48.7301249° N, 2.4343214° E]"
    },
    {
        "centre_name": "LE FIVE Sarcelles",
        "centre_place_id": "ChIJ6_q3Fxhq5kcRCpoEwnoXX1Q",
        "centre_location": "[48.99782219999999° N, 2.3902225° E]"
    },
    {
        "centre_name": "UrbanSoccer - Marne-La-Vallée",
        "centre_place_id": "ChIJ6bDBiosP5kcROXiloHzSdhc",
        "centre_location": "[48.82658600000001° N, 2.6296937° E]"
    },
    {
        "centre_name": "UrbanSoccer - Saint Etienne",
        "centre_place_id": "ChIJ6xFIgPWr9UcRxo6t2gZwcZM",
        "centre_location": "[45.4615409° N, 4.3921188° E]"
    },
    {
        "centre_name": "LE FIVE Bezons",
        "centre_place_id": "ChIJ71Mv0Wpk5kcRg-H9x7L-dXo",
        "centre_location": "[48.9190419° N, 2.2117725° E]"
    },
    {
        "centre_name": "LE FIVE Paris 17",
        "centre_place_id": "ChIJ7eI8sFNv5kcR5xy52Wc57NU",
        "centre_location": "[48.900032° N, 2.3213449° E]"
    },
    {
        "centre_name": "SOFIVE - ALAMEDA",
        "centre_place_id": "ChIJ82pNBpyBj4ARkbKldllNAAE",
        "centre_location": "[37.78234174603494° N, 122.30112808650627° W]"
    },
    {
        "centre_name": "LE FIVE Nancy",
        "centre_place_id": "ChIJ84QrCMaYlEcRF5c_hb5H97c",
        "centre_location": "[48.6450904° N, 6.189443° E]"
    },
    {
        "centre_name": "LE FIVE Créteil",
        "centre_place_id": "ChIJ88lx3VwL5kcRVxCh4lD6_Gk",
        "centre_location": "[48.7643086° N, 2.4706522° E]"
    },
    {
        "centre_name": "Le Klube Dijon",
        "centre_place_id": "ChIJ8Tuh1mpi7UcRwv5WsRCd1fc",
        "centre_location": "[47.3564016° N, 5.0383111° E]"
    },
    {
        "centre_name": "LE FIVE Colomiers",
        "centre_place_id": "ChIJ8wxhgGexrhIRm698kMPQIRw",
        "centre_location": "[43.6189694° N, 1.3434047° E]"
    },
    {
        "centre_name": "West Houston Indoor Soccer",
        "centre_place_id": "ChIJ92iJxOzZQIYRuhDjEWRNgyw",
        "centre_location": "[29.831163819712472° N, 95.6598586693082° W]"
    },
    {
        "centre_name": "LE FIVE Strasbourg",
        "centre_place_id": "ChIJ934qQbG3lkcRm6TibMl6fgg",
        "centre_location": "[48.5899458° N, 7.680286100000001° E]"
    },
    {
        "centre_name": "UrbanSoccer - Clermont Aubière",
        "centre_place_id": "ChIJ96RKNVAc90cRD9SqpCA54CA",
        "centre_location": "[45.7550465° N, 3.1363437° E]"
    },
    {
        "centre_name": "LE FIVE Carrières-sous-Poissy",
        "centre_place_id": "ChIJ9T4fWfyL5kcRCBX-FyZLvEE",
        "centre_location": "[48.9468144° N, 2.0230574° E]"
    },
    {
        "centre_name": "Le Smile Sautron",
        "centre_place_id": "ChIJ9Wv9FbuTBUgRQNYd2r8vvrI",
        "centre_location": "[47.2518597° N, 1.6574509° W]"
    },
    {
        "centre_name": "LE FIVE Morangis",
        "centre_place_id": "ChIJA4uAhOXZ5UcRp-vZXZP-ovY",
        "centre_location": "[48.692672° N, 2.3192811° E]"
    },
    {
        "centre_name": "AU FIVE Saint Raphaël",
        "centre_place_id": "ChIJAQCwb4KXzhIRdJFsgoCRJyE",
        "centre_location": "[43.4292109° N, 6.789112800000001° E]"
    },
    {
        "centre_name": "Foot Indoor Limay",
        "centre_place_id": "ChIJAQDAMXiV5kcRrL5fPp5Dj7g",
        "centre_location": "[48.9895331° N, 1.7603096° E]"
    },
    {
        "centre_name": "LE 5 DE LEGENDE",
        "centre_place_id": "ChIJAQNaA3nc9EcRYvB35x41mBs",
        "centre_location": "[45.7617542° N, 4.9413708° E]"
    },
    {
        "centre_name": "Soccer Rooftop",
        "centre_place_id": "ChIJATah1RUX2jERAQV1-6wbBpM",
        "centre_location": "[25.7687609° N, 80.1906874° W]"
    },
    {
        "centre_name": "LE FIVE La Rochelle",
        "centre_place_id": "ChIJAYcXu5xNAUgRiFOwJiUbggQ",
        "centre_location": "[46.16183179999999° N, 1.0915968° W]"
    },
    {
        "centre_name": "uScore Soccer",
        "centre_place_id": "ChIJAdKS7b0yR4YRLzlho5qjzXQ",
        "centre_location": "[30.05907900500951° N, 95.54547281349058° W]"
    },
    {
        "centre_name": "UrbanSoccer - Nantes St-Sébastien",
        "centre_place_id": "ChIJAyKrntzoBUgRF09hrORC2nc",
        "centre_location": "[47.1902798° N, 1.4846704° W]"
    },
    {
        "centre_name": "Garden Soccer",
        "centre_place_id": "ChIJB1Epk28EyRIRXiphlsMqnOU",
        "centre_location": "[43.1142128° N, 5.8451366° E]"
    },
    {
        "centre_name": "Northridge Futsal",
        "centre_place_id": "ChIJBTa6FXebwoARpBWTlIVZOSY",
        "centre_location": "[34.2371721° N, 118.5713859° W]"
    },
    {
        "centre_name": "Soccer Rennais",
        "centre_place_id": "ChIJBWiWc1HgDkgRnIHJ7R5SVU0",
        "centre_location": "[48.1003888° N, 1.7320165° W]"
    },
    {
        "centre_name": "UrbanSoccer - Angers",
        "centre_place_id": "ChIJBcOLHhJ_CEgRBi_FUHPvAQ0",
        "centre_location": "[47.472353° N, 0.6048954999999999° W]"
    },
    {
        "centre_name": "Pegaso Soccer",
        "centre_place_id": "ChIJC8qhZ6m22YgRyRMteyq-EoU",
        "centre_location": "[25.79752568307743° N, 80.19176688650941° W]"
    },
    {
        "centre_name": "Bordeaux Soccer",
        "centre_place_id": "ChIJCRHQufUoVQ0RmXgf8oHOE08",
        "centre_location": "[44.8710961° N, 0.5620394° W]"
    },
    {
        "centre_name": "Football Club de Yutz",
        "centre_place_id": "ChIJD2NADbYklUcRLuKRL-fYqTU",
        "centre_location": "[49.3564109° N, 6.1960091° E]"
    },
    {
        "centre_name": "Le Stadium Compiègne",
        "centre_place_id": "ChIJDX03WfbX50cR_4gqKIFvcqk",
        "centre_location": "[49.427907° N, 2.849432° E]"
    },
    {
        "centre_name": "Arena 5",
        "centre_place_id": "ChIJE8mb-Dow4EcRP3o5L88W8y4",
        "centre_location": "[49.5003798° N, 0.1900191° E]"
    },
    {
        "centre_name": "Stadio Soccer",
        "centre_place_id": "ChIJE8piT3Kx2YgRiH6pVi9sIvM",
        "centre_location": "[25.842363863477672° N, 80.20647252512583° W]"
    },
    {
        "centre_name": "Padel and Foot Strasbourg",
        "centre_place_id": "ChIJE9ZciNLHlkcRF9bBiXbLuYk",
        "centre_location": "[48.6273689° N, 7.769607499999998° E]"
    },
    {
        "centre_name": "UrbanSoccer Nantes - Carquefou",
        "centre_place_id": "ChIJEWyPupv7BUgRBqnhym4EyLk",
        "centre_location": "[47.2875443° N, 1.4802803° W]"
    },
    {
        "centre_name": "Estuary Park - Alameda",
        "centre_place_id": "ChIJF0eB88GAj4ARK7EcyG0E-28",
        "centre_location": "[37.78986132958717° N, 122.28681286931655° W]"
    },
    {
        "centre_name": "Futbol Fever",
        "centre_place_id": "ChIJFSHIaJTB2YgRzi-_B_FVHtw",
        "centre_location": "[25.656851559577476° N, 80.4254955306918° W]"
    },
    {
        "centre_name": "Breizh Soccer",
        "centre_place_id": "ChIJFUMBTCUZEEgRd1d648O0VI0",
        "centre_location": "[47.68108669999999° N, 2.8025865° W]"
    },
    {
        "centre_name": "Classico Foot",
        "centre_place_id": "ChIJFV442oCxrhIRgsZy5aIbkNs",
        "centre_location": "[43.5945434° N, 1.2911399° E]"
    },
    {
        "centre_name": "We Are Sports",
        "centre_place_id": "ChIJFZU5oBHC9EcRJTFrSkI1xxg",
        "centre_location": "[45.7113247° N, 4.8761886° E]"
    },
    {
        "centre_name": "Monclub Futbol",
        "centre_place_id": "ChIJGbxxaamUyRIRgGvhHnhJStA",
        "centre_location": "[43.4299152° N, 5.4001974° E]"
    },
    {
        "centre_name": "Footsall Omnisports Mâcon",
        "centre_place_id": "ChIJGfUohl5u80cRkNdhfgbvDA0",
        "centre_location": "[46.3151371° N, 4.832474299999999° E]"
    },
    {
        "centre_name": "Goal In d'Or La Farlède",
        "centre_place_id": "ChIJHT4IIT8YyRIREI_EDEAf9gE",
        "centre_location": "[43.1531426° N, 6.042328100000001° E]"
    },
    {
        "centre_name": "OHSPORT",
        "centre_place_id": "ChIJHeG9fA4X5kcRbGNzVY5Ud5I",
        "centre_location": "[48.9672396° N, 2.5670436° E]"
    },
    {
        "centre_name": "Soccer 5 Tropical Park",
        "centre_place_id": "ChIJI2JYMoa42YgRP0sx16u-fRo",
        "centre_location": "[25.730190947225587° N, 80.3241452539623° W]"
    },
    {
        "centre_name": "Soccer City Miami",
        "centre_place_id": "ChIJIRUjAre-2YgRw_lDJcG3dD8",
        "centre_location": "[25.796380747019104° N, 80.37480238465409° W]"
    },
    {
        "centre_name": "Insport Montpellier - Près d'arènes",
        "centre_place_id": "ChIJJWIca-qvthIRHxcGJpAq4kA",
        "centre_location": "[43.5867499° N, 3.8863806° E]"
    },
    {
        "centre_name": "Angers SCO Footsal",
        "centre_place_id": "ChIJJXOtQ3d5CEgR5gqmLBWjkK4",
        "centre_location": "[47.4598867° N, 0.5293736° W]"
    },
    {
        "centre_name": "FOOTMAX Saint-Maximin",
        "centre_place_id": "ChIJJazitpdJ5kcRIN9wK_jwKUY",
        "centre_location": "[49.2391128° N, 2.4577023° E]"
    },
    {
        "centre_name": "LE FIVE Montreuil",
        "centre_place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44",
        "centre_location": "[48.8607303° N, 2.4650432° E]"
    },
    {
        "centre_name": "Stadium FIVE Center Perpignan",
        "centre_place_id": "ChIJK88_lR9wsBIRvGy5h9RQAaQ",
        "centre_location": "[42.6914386° N, 2.8492865° E]"
    },
    {
        "centre_name": "Z5 Aix",
        "centre_place_id": "ChIJKb-U_9KSyRIRKIFKbH5mW18",
        "centre_location": "[43.4787869° N, 5.3969048° E]"
    },
    {
        "centre_name": "Player 5M Bessan",
        "centre_place_id": "ChIJKcIlfy4-sRIRQpnxhc225GU",
        "centre_location": "[43.373057° N, 3.4271789° E]"
    },
    {
        "centre_name": "Olive et Tom Foot",
        "centre_place_id": "ChIJM91frs_gyRIR0DmRNXYM0hc",
        "centre_location": "[43.3955137° N, 5.1351071° E]"
    },
    {
        "centre_name": "LE PARK Servon",
        "centre_place_id": "ChIJMU8gErUJ5kcRSnpvacKwFtM",
        "centre_location": "[48.71189589999999° N, 2.5771181° E]"
    },
    {
        "centre_name": "Fun Foot Ajaccio",
        "centre_place_id": "ChIJMYDG2oxr2hIR2VIfssGUycU",
        "centre_location": "[41.9558805° N, 8.7816756° E]"
    },
    {
        "centre_name": "LE FIVE Saint-Louis La Réunion",
        "centre_place_id": "ChIJMZT87I2ggiERx46yqMI-es4",
        "centre_location": "[21.2902719° S, 55.39892039999999° E]"
    },
    {
        "centre_name": "UrbanSoccer - Puteaux",
        "centre_place_id": "ChIJM_sC0-Nk5kcRhL1y_EFIje8",
        "centre_location": "[48.8836397° N, 2.2312283° E]"
    },
    {
        "centre_name": "UrbanSoccer - Lyon Barolles",
        "centre_place_id": "ChIJN4l-IC3v9EcRf9QJKIVC_aY",
        "centre_location": "[45.6837539° N, 4.7725939° E]"
    },
    {
        "centre_name": "Game 13 foot indoor",
        "centre_place_id": "ChIJNSDvlsXryRIRUXao9hwB79I",
        "centre_location": "[43.41258939999999° N, 5.366617° E]"
    },
    {
        "centre_name": "Sports and Play Lançon de Provence",
        "centre_place_id": "ChIJN_Jhj3P9yRIRB_PmaXuccA0",
        "centre_location": "[43.5917175° N, 5.110592899999999° E]"
    },
    {
        "centre_name": "Factory Sport Games",
        "centre_place_id": "ChIJNcDntQGO9EcR3CbXF7xfc5o",
        "centre_location": "[45.8874393° N, 4.7216857° E]"
    },
    {
        "centre_name": "Chelsea Piers",
        "centre_place_id": "ChIJNcurQqBZwokRYDgoFu6QXCI",
        "centre_location": "[40.7481792° N, 74.0111891° W]"
    },
    {
        "centre_name": "Sofive Meadowlands",
        "centre_place_id": "ChIJNx4uAWf4wokRSocDyrK32sk",
        "centre_location": "[40.824795° N, 74.0682588° W]"
    },
    {
        "centre_name": "Socceroof New Rochelle",
        "centre_place_id": "ChIJO-ZGkm6NwokRH5LzBlNfsIQ",
        "centre_location": "[40.91151018691811° N, 73.77849741349058° W]"
    },
    {
        "centre_name": "LE FIVE Paris 18",
        "centre_place_id": "ChIJPVT4_n1u5kcRzji6FdTBXXo",
        "centre_location": "[48.8978522° N, 2.3700234° E]"
    },
    {
        "centre_name": "7 & Match Mondragon",
        "centre_place_id": "ChIJPa2mELahtRIRikXKS6RPLqI",
        "centre_location": "[44.2592° N, 4.706397° E]"
    },
    {
        "centre_name": "Play Soccer",
        "centre_place_id": "ChIJQ-UxZn-5rhIRKWoQydM5T9s",
        "centre_location": "[43.5512023° N, 1.4098927° E]"
    },
    {
        "centre_name": "SOFIVE - SOUTHGATE",
        "centre_place_id": "ChIJQ2LL-D3MwoAR6vKb3yEZvgk",
        "centre_location": "[33.94566430088488° N, 118.18306155767087° W]"
    },
    {
        "centre_name": "CS Veymerange",
        "centre_place_id": "ChIJQVuGzPsvlUcRg6R0U-o5k9M",
        "centre_location": "[49.359315° N, 6.109758° E]"
    },
    {
        "centre_name": "UrbanSoccer - Lille Lezennes",
        "centre_place_id": "ChIJR3ro5nTWwkcRfM_S3Be9HjI",
        "centre_location": "[50.6169533° N, 3.0995426° E]"
    },
    {
        "centre_name": "Le 13 - Foot en salle - Marseille",
        "centre_place_id": "ChIJR62kUm_ByRIRDnGQqGCeUVQ",
        "centre_location": "[43.33370070000001° N, 5.370389599999999° E]"
    },
    {
        "centre_name": "KG5 Strasbourg-Mundolsheim",
        "centre_place_id": "ChIJRSG64gm4lkcRPQTZbn3M85Q",
        "centre_location": "[48.6354584° N, 7.724195300000001° E]"
    },
    {
        "centre_name": "L'Arène Chartres",
        "centre_place_id": "ChIJRaMGi5gN5EcR_sqZitCqLPY",
        "centre_location": "[48.4251475° N, 1.4542319° E]"
    },
    {
        "centre_name": "UrbanSoccer Rennes Vern",
        "centre_place_id": "ChIJS5VW0FUnD0gRUd2xV2pEeKY",
        "centre_location": "[48.06725309999999° N, 1.6016538° W]"
    },
    {
        "centre_name": "Superdome Sports Waldwick",
        "centre_place_id": "ChIJSRmb-4bjwokRX7H7p_nGfn8",
        "centre_location": "[41.0193689° N, 74.1299584° W]"
    },
    {
        "centre_name": "Stadium Antibes",
        "centre_place_id": "ChIJSSGxg-PUzRIRblID9ACQndc",
        "centre_location": "[43.6121609° N, 7.122323° E]"
    },
    {
        "centre_name": "UrbanSoccer - Dijon",
        "centre_place_id": "ChIJT3z7m-Nh7UcRm7VB5bhK3d0",
        "centre_location": "[47.3404773° N, 5.0728491° E]"
    },
    {
        "centre_name": "LE FIVE Villette",
        "centre_place_id": "ChIJTUFnQjps5kcR0pHITLTw1PI",
        "centre_location": "[48.9070122° N, 2.3861459° E]"
    },
    {
        "centre_name": "UrbanSoccer Bordeaux-Pessac",
        "centre_place_id": "ChIJTZ1wTCnZVA0Ra5hHoMEPn3I",
        "centre_location": "[44.7788147° N, 0.6443808° W]"
    },
    {
        "centre_name": "Football 5 Club Rosny",
        "centre_place_id": "ChIJTcHVp4S55kcRUD4Mh5Pro98",
        "centre_location": "[48.994969° N, 1.648947° E]"
    },
    {
        "centre_name": "THE SOC5CER - Montauban",
        "centre_place_id": "ChIJUc4N5XYSrBIRidC7hrwrqJ0",
        "centre_location": "[44.0388804° N, 1.3716001° E]"
    },
    {
        "centre_name": "UrbanSoccer Le Mans",
        "centre_place_id": "ChIJV4SAsGqP4kcRQZ1u_kOCHfc",
        "centre_location": "[47.96290399999999° N, 0.2185836° E]"
    },
    {
        "centre_name": "LE FIVE Bobigny",
        "centre_place_id": "ChIJV8UONORs5kcRXxR5Qd7x130",
        "centre_location": "[48.901553° N, 2.4313304° E]"
    },
    {
        "centre_name": "Soccertime",
        "centre_place_id": "ChIJVRdtdwa3QIYRzwyM77_hWMk",
        "centre_location": "[29.902846592048324° N, 95.34697552698111° W]"
    },
    {
        "centre_name": "UrbanSoccer - Villeneuve Loubet",
        "centre_place_id": "ChIJVVVVEU3TzRIRX9_gbFDSBj0",
        "centre_location": "[43.6614017° N, 7.095247199999999° E]"
    },
    {
        "centre_name": "Soccer Planet",
        "centre_place_id": "ChIJVVVVVQnXDIgRLBG0gleJUeg",
        "centre_location": "[40.13698101467192° N, 88.20024569393073° W]"
    },
    {
        "centre_name": "UrbanSoccer - Montpellier",
        "centre_place_id": "ChIJVXFMq4ylthIRtrZPBHOMTAc",
        "centre_location": "[43.6287935° N, 3.9096721° E]"
    },
    {
        "centre_name": "LE FIVE Annemasse",
        "centre_place_id": "ChIJVc4JI-FtjEcRkBpWIDCVoII",
        "centre_location": "[46.206535° N, 6.280475° E]"
    },
    {
        "centre_name": "UrbanSoccer Evry",
        "centre_place_id": "ChIJW0Ut1G7e5UcRt621n2fRQ5M",
        "centre_location": "[48.6286849° N, 2.4066366° E]"
    },
    {
        "centre_name": "UrbanSoccer - Limoges",
        "centre_place_id": "ChIJW6IzlEUz-UcRIlyS1lolmbc",
        "centre_location": "[45.8084631° N, 1.2586858° E]"
    },
    {
        "centre_name": "SOFIVE - POMONA",
        "centre_place_id": "ChIJWTYmoZwtw4ARhhKsGjxJqdg",
        "centre_location": "[34.030507485598804° N, 117.74941894232914° W]"
    },
    {
        "centre_name": "Soccer Center",
        "centre_place_id": "ChIJWbH3tXW6FkgRHdcPREqDrwA",
        "centre_location": "[48.419831° N, 4.4206516° W]"
    },
    {
        "centre_name": "Evolution Football",
        "centre_place_id": "ChIJX0YulIi8yRIRnGh62u3UXTQ",
        "centre_location": "[43.2836074° N, 5.52356° E]"
    },
    {
        "centre_name": "UrbanSoccer - Grenoble",
        "centre_place_id": "ChIJX6YWdrz1ikcRwdG7lUc49fg",
        "centre_location": "[45.2039795° N, 5.7734857° E]"
    },
    {
        "centre_name": "Le Temple du Foot",
        "centre_place_id": "ChIJX6tTCaTg4EcREj-uKrMtLMc",
        "centre_location": "[49.426831° N, 1.0517861° E]"
    },
    {
        "centre_name": "Champions Five",
        "centre_place_id": "ChIJX7pTGkosi0cR22J6MKLnxdw",
        "centre_location": "[45.58942150000001° N, 5.249078799999999° E]"
    },
    {
        "centre_name": "Footsal Cousinerie",
        "centre_place_id": "ChIJXQyb1d8pw0cRLO_Ed5xHTIQ",
        "centre_location": "[50.6440829° N, 3.1459612° E]"
    },
    {
        "centre_name": "Footbox",
        "centre_place_id": "ChIJY-WkusIR5kcR-tEad3UtaSQ",
        "centre_location": "[48.9022789° N, 2.582647° E]"
    },
    {
        "centre_name": "LAB FIVE SOCCER - GARDENA",
        "centre_place_id": "ChIJYTdldJm1woAReOjW_rwNSkU",
        "centre_location": "[33.9187101° N, 118.4756534° W]"
    },
    {
        "centre_name": "Globall Sports Centers - Brooklyn",
        "centre_place_id": "ChIJYVUE_J9bwokRuEBZfRYfobU",
        "centre_location": "[40.669039084914175° N, 73.95544310185534° W]"
    },
    {
        "centre_name": "Houston Soccer Field",
        "centre_place_id": "ChIJYwnTqjHXQIYRDyENYgvwCWo",
        "centre_location": "[29.88951902486861° N, 95.6972776276646° W]"
    },
    {
        "centre_name": "SFF Soccer - Mission Bay Field",
        "centre_place_id": "ChIJZ0Mj1s9_j4ARt4-u90l2X84",
        "centre_location": "[37.77075567780977° N, 122.39383338651577° W]"
    },
    {
        "centre_name": "Mission Playground Soccer Pitch",
        "centre_place_id": "ChIJZ0zooD1-j4ARzVFrHova9O4",
        "centre_location": "[37.759551392518865° N, 122.422365701848° W]"
    },
    {
        "centre_name": "ARENA 18 Caudan",
        "centre_place_id": "ChIJZ79NO6deEEgRVJrNAlg8mQs",
        "centre_location": "[47.781178° N, 3.3327791° W]"
    },
    {
        "centre_name": "LE COMPLEXE Salon-de-Provence",
        "centre_place_id": "ChIJZdrYy1D-yRIRrrlLXLwuv5Y",
        "centre_location": "[43.6310619° N, 5.0960468° E]"
    },
    {
        "centre_name": "Granada Indoor Soccer",
        "centre_place_id": "ChIJZe5X38-p2YgR7V1S_g4R5X8",
        "centre_location": "[26.046520685979374° N, 80.20800859814467° W]"
    },
    {
        "centre_name": "Maya Indoor Soccer",
        "centre_place_id": "ChIJZwtLpkDNQIYRyLJuiJ7U-qQ",
        "centre_location": "[29.997407130600056° N, 95.48662730977993° W]"
    },
    {
        "centre_name": "Futbol Futbol Artigues",
        "centre_place_id": "ChIJZziKe5cvVQ0R5tJa9BeDd8o",
        "centre_location": "[44.8685685° N, 0.5712569° W]"
    },
    {
        "centre_name": "THE FIVE Tours",
        "centre_place_id": "ChIJ_W2Q_SPV_EcRj3zLt_rpEw4",
        "centre_location": "[47.4324282° N, 0.6918124° E]"
    },
    {
        "centre_name": "LIGUA FIVE Saint-Brevin",
        "centre_place_id": "ChIJ_____yNwBUgRSG7Jc1nxPmY",
        "centre_location": "[47.2318916° N, 2.1496915° W]"
    },
    {
        "centre_name": "LE FIVE Paris 13",
        "centre_place_id": "ChIJ_bOSChhz5kcRZMTeq_6Gdzg",
        "centre_location": "[48.8181615° N, 2.3658793° E]"
    },
    {
        "centre_name": "Socceroof Crown Heights",
        "centre_place_id": "ChIJ_wfNJBVdwokRoU3ZUxM4oTc",
        "centre_location": "[40.6774413° N, 73.9342119° W]"
    },
    {
        "centre_name": "Le B3 Soccer",
        "centre_place_id": "ChIJa69uraDryRIRRlY7a07cUqU",
        "centre_location": "[43.4263643° N, 5.365863600000001° E]"
    },
    {
        "centre_name": "Footsal",
        "centre_place_id": "ChIJa7HS298pw0cRMoVDj0XqVdI",
        "centre_location": "[50.6397895° N, 3.1251337° E]"
    },
    {
        "centre_name": "LE FIVE Saint-Louis - Bâle",
        "centre_place_id": "ChIJa9Anja27kUcRNXt6NgUDdmY",
        "centre_location": "[47.6019391° N, 7.5448664° E]"
    },
    {
        "centre_name": "LE FIVE Reims",
        "centre_place_id": "ChIJad8c0qR16UcRMPDMaa34XJ8",
        "centre_location": "[49.2687603° N, 4.0383523° E]"
    },
    {
        "centre_name": "The Indoor Soccer Box",
        "centre_place_id": "ChIJadntBAbbQIYRlM2WxDsMz7I",
        "centre_location": "[29.801679174248164° N, 95.56183835581763° W]"
    },
    {
        "centre_name": "B14 - Sports et Loisirs Indoor",
        "centre_place_id": "ChIJaeLKMYXe5UcRHyWJ8X8FaPA",
        "centre_location": "[48.62229° N, 2.3800445° E]"
    },
    {
        "centre_name": "Superdome Sports Fairlawn",
        "centre_place_id": "ChIJb1_Rbhn7wokRPcV_ZAeB8mE",
        "centre_location": "[41.0201009° N, 74.2188497° W]"
    },
    {
        "centre_name": "STADIUM FOOT 5 VILLAGE",
        "centre_place_id": "ChIJbbOWFtC4yRIR0WXVerbWmnE",
        "centre_location": "[43.269413° N, 5.4260321° E]"
    },
    {
        "centre_name": "UrbanSoccer - Strasbourg",
        "centre_place_id": "ChIJbeF8CznIlkcRkTmqhGiUECc",
        "centre_location": "[48.5935464° N, 7.731737300000001° E]"
    },
    {
        "centre_name": "Socceroof New Rochelle",
        "centre_place_id": "ChIJcTtBl5GNwokRUooEpetsCCc",
        "centre_location": "[40.7807691° N, 73.9012111° W]"
    },
    {
        "centre_name": "Anse Foot",
        "centre_place_id": "ChIJc_uyt2s92jERFAD6KeKs66c",
        "centre_location": "[45.9498454° N, 4.7368653° E]"
    },
    {
        "centre_name": "EFIVE Avignon Vedene",
        "centre_place_id": "ChIJd-UEcsXztRIRA9jWoQe2RtU",
        "centre_location": "[43.97166319999999° N, 4.894042° E]"
    },
    {
        "centre_name": "LE PARK Noisy",
        "centre_place_id": "ChIJdUHbID8O5kcRV5lQhiHTvhs",
        "centre_location": "[48.8337843° N, 2.5728501° E]"
    },
    {
        "centre_name": "SOFIVE - UPLAND",
        "centre_place_id": "ChIJdxqeoAwxw4ARVXVSJLpNtVE",
        "centre_location": "[34.104186873863284° N, 117.68452261349374° W]"
    },
    {
        "centre_name": "VSD39 Dole",
        "centre_place_id": "ChIJeSnd96VNjUcRMB1eWaVkmKs",
        "centre_location": "[47.10255979999999° N, 5.5016487° E]"
    },
    {
        "centre_name": "Arena Club",
        "centre_place_id": "ChIJeWJWRjYvw0cRbnJR4ZXAKMA",
        "centre_location": "[50.7696017° N, 3.1236104° E]"
    },
    {
        "centre_name": "District de football du Val de Marne",
        "centre_place_id": "ChIJee8K100N5kcRNfLktIYBoqs",
        "centre_location": "[48.8279749° N, 2.479325° E]"
    },
    {
        "centre_name": "Events Five",
        "centre_place_id": "ChIJf8cSCJG5rhIRoQadPH-wW1U",
        "centre_location": "[43.5399703° N, 1.3922897° E]"
    },
    {
        "centre_name": "Fit'n Soccer Sedan",
        "centre_place_id": "ChIJfWQYaM9v6kcR5wfQjFQqpv4",
        "centre_location": "[49.6973533° N, 4.918232600000001° E]"
    },
    {
        "centre_name": "Top Ten",
        "centre_place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek",
        "centre_location": "[48.8729106° N, 2.6840919° E]"
    },
    {
        "centre_name": "UrbanSoccer - Quai d'Ivry",
        "centre_place_id": "ChIJfXxYJ0xy5kcRw9xTkF6-FZQ",
        "centre_location": "[48.8199815° N, 2.3936307° E]"
    },
    {
        "centre_name": "Main Street Soccer",
        "centre_place_id": "ChIJfdu-8NK4QIYRsNk7vR_t9S4",
        "centre_location": "[29.775779278923967° N, 95.36007964283036° W]"
    },
    {
        "centre_name": "LAB FIVE SOCCER - PACOIMA",
        "centre_place_id": "ChIJfzPcqtaRwoARXvzkvoBBQ5Y",
        "centre_location": "[34.2480354° N, 118.4095802° W]"
    },
    {
        "centre_name": "Z5 Istres",
        "centre_place_id": "ChIJg2T7dqcdthIRsQBEO9wiews",
        "centre_location": "[43.4755916° N, 4.9937654° E]"
    },
    {
        "centre_name": "Ball In d'Or Dreux",
        "centre_place_id": "ChIJgRwhLzZV4UcRZ1kZ41ivPqU",
        "centre_location": "[48.7468231° N, 1.3611978° E]"
    },
    {
        "centre_name": "Ligue Bourgogne-Franche-Comté de Football",
        "centre_place_id": "ChIJgdPp24md8kcRRh_JKU2tDmA",
        "centre_location": "[47.30228779999999° N, 5.061791899999999° E]"
    },
    {
        "centre_name": "UrbanSoccer La Défense",
        "centre_place_id": "ChIJh4rnfVhk5kcRV2Q-ZKdm8vA",
        "centre_location": "[48.8996456° N, 2.2216773° E]"
    },
    {
        "centre_name": "Kinshasa - Test",
        "centre_place_id": "ChIJi2oG_jAxahoRjTdSH05-ixY",
        "centre_location": "[4.3032527° S, 15.310528° E]"
    },
    {
        "centre_name": "LE FIVE Vitrolles",
        "centre_place_id": "ChIJi4A-IrHoyRIRunoYLEGNeYI",
        "centre_location": "[43.4338497° N, 5.240971399999999° E]"
    },
    {
        "centre_name": "UrbanSoccer - Asnières",
        "centre_place_id": "ChIJi5LkLT9v5kcRSlhScqEFNWs",
        "centre_location": "[48.92192379999999° N, 2.3068311° E]"
    },
    {
        "centre_name": "Foot-Max Argenteuil",
        "centre_place_id": "ChIJi9oIzaRm5kcRJYcK7QsdRMU",
        "centre_location": "[48.9501632° N, 2.2093946° E]"
    },
    {
        "centre_name": "Lets Play!",
        "centre_place_id": "ChIJiQuEX3joQIYRrK99NAG9BjM",
        "centre_location": "[30.005827652440544° N, 95.72533175035791° W]"
    },
    {
        "centre_name": "DK Park / LE FIVE Dunkerque",
        "centre_place_id": "ChIJj70TyWiL3EcR7iZ1fa-JRNk",
        "centre_location": "[51.01440059999999° N, 2.3477199° E]"
    },
    {
        "centre_name": "F5 Foot Five",
        "centre_place_id": "ChIJjUbM5G7A9EcRW3mlkrhyXxY",
        "centre_location": "[45.7857911° N, 4.905926399999999° E]"
    },
    {
        "centre_name": "Five Factory Le Havre",
        "centre_place_id": "ChIJk-ujvdYv4EcRXoLCtLvjW7I",
        "centre_location": "[49.4930667° N, 0.1707863° E]"
    },
    {
        "centre_name": "UrbanSoccer - Toulouse Sept Deniers",
        "centre_place_id": "ChIJk5nUBdOkrhIRP-1aUJzo-lA",
        "centre_location": "[43.6321552° N, 1.411696° E]"
    },
    {
        "centre_name": "Soccer Team Alès",
        "centre_place_id": "ChIJk7CiF_xCtBIRIBZ_Q1ozEQg",
        "centre_location": "[44.1421138° N, 4.1065699° E]"
    },
    {
        "centre_name": "UrbanSoccer - Toulouse Montaudran",
        "centre_place_id": "ChIJl772e0u8rhIR2foRX4Xa2CI",
        "centre_location": "[43.574642° N, 1.4801835° E]"
    },
    {
        "centre_name": "UrbanSoccer Guyancourt",
        "centre_place_id": "ChIJmdX-2c-A5kcRj1wtOS8rZmo",
        "centre_location": "[48.7722091° N, 2.0600292° E]"
    },
    {
        "centre_name": "LE FIVE OL",
        "centre_place_id": "ChIJmz3whejH9EcR3j9ApNRukKE",
        "centre_location": "[45.7673403° N, 4.9802325° E]"
    },
    {
        "centre_name": "VERSUSFOOT Thiais",
        "centre_place_id": "ChIJn2R2NT905kcRjqB29qldBxk",
        "centre_location": "[48.7501009° N, 2.3802899° E]"
    },
    {
        "centre_name": "BALL CONCEPT Monplaisir",
        "centre_place_id": "ChIJn7xJyorytRIR5fCxB3seBOs",
        "centre_location": "[43.9521998° N, 4.8707766° E]"
    },
    {
        "centre_name": "Le CR5",
        "centre_place_id": "ChIJnVE47IHn5UcRr5XRwCaPE38",
        "centre_location": "[48.5655349° N, 2.4533388° E]"
    },
    {
        "centre_name": "Le Sporting Nantes",
        "centre_place_id": "ChIJo-3LeLXsBUgRu6gtAgQ6sJA",
        "centre_location": "[47.2215137° N, 1.6415682° W]"
    },
    {
        "centre_name": "Sport4lux Munsbach",
        "centre_place_id": "ChIJoTqB5CJmkUcRheYL3WcGzXo",
        "centre_location": "[49.6436457° N, 6.2721703° E]"
    },
    {
        "centre_name": "Sport dans la Ville Rhône-Alpes",
        "centre_place_id": "ChIJoUEDcmvr9EcRILCz6hDCQ2o",
        "centre_location": "[45.7811703° N, 4.8081568° E]"
    },
    {
        "centre_name": "FOOT IN FIVE",
        "centre_place_id": "ChIJoUR0syFp5kcRUlStnwluaYY",
        "centre_location": "[48.9552257° N, 2.3328346° E]"
    },
    {
        "centre_name": "LE FIVE Metz",
        "centre_place_id": "ChIJodpwmbLblEcRGk4-_FQorf4",
        "centre_location": "[49.0861769° N, 6.1183378° E]"
    },
    {
        "centre_name": "GFC Foot Indoor Mulhouse",
        "centre_place_id": "ChIJofRGnUSbkUcRzYQUtJAexeE",
        "centre_location": "[47.7566418° N, 7.313073300000001° E]"
    },
    {
        "centre_name": "UrbanSoccer Orsay",
        "centre_place_id": "ChIJpZIJg7J45kcRrKWKhtbfnEQ",
        "centre_location": "[48.70829° N, 2.17794° E]"
    },
    {
        "centre_name": "S-FIVE5",
        "centre_place_id": "ChIJqzie9xRL5kcRyg89AlwL55E",
        "centre_location": "[49.2732684° N, 2.4747214° E]"
    },
    {
        "centre_name": "Foot&Balls",
        "centre_place_id": "ChIJrd55eqy9_UcRafBnS1pNdaU",
        "centre_location": "[46.6244345° N, 0.353363° E]"
    },
    {
        "centre_name": "Socceroof Sunset Park",
        "centre_place_id": "ChIJrfgrMK9awokR-Z5O20hCD3w",
        "centre_location": "[40.6453926° N, 74.0238801° W]"
    },
    {
        "centre_name": "Kaiser Park",
        "centre_place_id": "ChIJsRLZzKFg5kcRBCfNws9nssw",
        "centre_location": "[49.0175545° N, 2.1775301° E]"
    },
    {
        "centre_name": "SOFIVE - RANCHO CUCAMONGA",
        "centre_place_id": "ChIJsUuykglKw4ARCHx7QxSVhoY",
        "centre_location": "[34.10097860080817° N, 117.54890858650627° W]"
    },
    {
        "centre_name": "LE FIVE Champigny",
        "centre_place_id": "ChIJsXi1PLYN5kcRTVVDuczgS2s",
        "centre_location": "[48.8194084° N, 2.5251846° E]"
    },
    {
        "centre_name": "LE FIVE Orléans Fleury",
        "centre_place_id": "ChIJsYfwe3n75EcRnjpH9sw356Q",
        "centre_location": "[47.9415754° N, 1.9358176° E]"
    },
    {
        "centre_name": "LE FIVE Valenciennes",
        "centre_place_id": "ChIJs_yKhaPvwkcRtt71kMRaz8A",
        "centre_location": "[50.3821465° N, 3.4713322° E]"
    },
    {
        "centre_name": "BIG5",
        "centre_place_id": "ChIJsb_7TJFp5kcRSPL5VqZulr4",
        "centre_location": "[48.9901429° N, 2.3617895° E]"
    },
    {
        "centre_name": "Soctainer",
        "centre_place_id": "ChIJt-kZfv622YgR4PrDZCA7JCw",
        "centre_location": "[25.765519921286128° N, 80.22743196220591° W]"
    },
    {
        "centre_name": "Le Street Foot en Salle",
        "centre_place_id": "ChIJt_AXL6Jg5kcRu6rBmnrmeUM",
        "centre_location": "[49.0164435° N, 2.181307° E]"
    },
    {
        "centre_name": "LE FIVE Bordeaux",
        "centre_place_id": "ChIJteaBh_koVQ0RqH2VtN-qL5I",
        "centre_location": "[44.8798631° N, 0.5594838999999999° W]"
    },
    {
        "centre_name": "Foot POWER 5",
        "centre_place_id": "ChIJuTCIFshm5kcRBtEQJ76dAzc",
        "centre_location": "[48.960066° N, 2.2061913° E]"
    },
    {
        "centre_name": "Shooting Stars Indoor Soccer",
        "centre_place_id": "ChIJu_DTlg8I2YgRQGdsz5y09e0",
        "centre_location": "[26.104292968314738° N, 80.28596592883648° W]"
    },
    {
        "centre_name": "MONCLUB 2.0",
        "centre_place_id": "ChIJv9owGLm-yRIRfuDnd3G6nR4",
        "centre_location": "[43.2895156° N, 5.4611522° E]"
    },
    {
        "centre_name": "Le Temple FIVE Center",
        "centre_place_id": "ChIJvcCWluNtsBIRYScZxAbEtxQ",
        "centre_location": "[42.6851653° N, 2.8541333° E]"
    },
    {
        "centre_name": "Sofive Brooklyn",
        "centre_place_id": "ChIJvytTY_JdwokRVMSxK5pjEyU",
        "centre_location": "[40.6719131° N, 73.8984085° W]"
    },
    {
        "centre_name": "Foot à 5 @ Le club le Village",
        "centre_place_id": "ChIJwU28MyyB5kcRHVcpV1mkYVo",
        "centre_location": "[48.766805° N, 2.026255° E]"
    },
    {
        "centre_name": "Spot FUTSAL",
        "centre_place_id": "ChIJwdUawmfVwkcRaNLo_CmNii0",
        "centre_location": "[50.6106345° N, 3.0624494° E]"
    },
    {
        "centre_name": "Le Classico 70 Héricourt",
        "centre_place_id": "ChIJwdVDuwo-kkcR5rIoryU9p4k",
        "centre_location": "[47.5826352° N, 6.775028° E]"
    },
    {
        "centre_name": "UrbanSoccer - Lyon Parilly",
        "centre_place_id": "ChIJx3FQWjLC9EcRrrQb2eV7i_4",
        "centre_location": "[45.7120399° N, 4.9039284° E]"
    },
    {
        "centre_name": "Mondial Soccer Martigues",
        "centre_place_id": "ChIJxSxBZ0rmyRIRD43lI6mPqdE",
        "centre_location": "[43.40826250000001° N, 5.0265179° E]"
    },
    {
        "centre_name": "UrbanSoccer - Bordeaux Mérignac",
        "centre_place_id": "ChIJxWBxmALaVA0Rop0OWS3Q3fY",
        "centre_location": "[44.825426° N, 0.6839708999999999° W]"
    },
    {
        "centre_name": "Massilia Five",
        "centre_place_id": "ChIJxZ6UmMW-yRIR7ot5DChYj4w",
        "centre_location": "[43.2887115° N, 5.4478345° E]"
    },
    {
        "centre_name": "Massilia Foot Indoor 2",
        "centre_place_id": "ChIJxZ6UmMW-yRIRfYNGGPPJfIU",
        "centre_location": "[43.3266563° N, 5.3836488° E]"
    },
    {
        "centre_name": "Houston Sports Park",
        "centre_place_id": "ChIJxcqO6tTqQIYRnAUZYsEpl_s",
        "centre_location": "[29.63824644076503° N, 95.39520728279878° W]"
    },
    {
        "centre_name": "KIPSTADIUM",
        "centre_place_id": "ChIJydcoT88ow0cRLnHvlF-Z_jE",
        "centre_location": "[50.7085083° N, 3.1733057° E]"
    },
    {
        "centre_name": "GINGA Foot Mérignac",
        "centre_place_id": "ChIJyfJZiyPaVA0RlY6_mDcql7U",
        "centre_location": "[44.81810309999999° N, 0.678014° W]"
    },
    {
        "centre_name": "Downtown Soccer Miami",
        "centre_place_id": "ChIJz6UVWpa22YgRUJImJbvFehM",
        "centre_location": "[25.778722328274423° N, 80.2021569539623° W]"
    },
    {
        "centre_name": "Le Mercato FOOT INDOOR",
        "centre_place_id": "ChIJzRK7HJy_yRIRqEreyEiAfC0",
        "centre_location": "[43.3426654° N, 5.4084961° E]"
    },
    {
        "centre_name": "LE FIVE Orléans Ingré",
        "centre_place_id": "ChIJzUFPDv_v5EcRG6gmhm_t_HA",
        "centre_location": "[47.9057474° N, 1.8536754° E]"
    },
    {
        "centre_name": "LE FIVE Rouen",
        "centre_place_id": "ChIc7ot9ESvGhIRqni6q0J6B4fY",
        "centre_location": "[49.4276596° N, 1.1038652° E]"
    },
    {
        "centre_name": "Soccer Arena Manom",
        "centre_place_id": "ChIeaIuWCc7lUcRhgvoCbAgwIc",
        "centre_location": "[49.2978099° N, 6.0440503° E]"
    },
    {
        "centre_name": "L'ÉTINCELLE Sélestat",
        "centre_place_id": "ChIemIPT3S7dEkcRHYSOAnApZaA",
        "centre_location": "[48.2537206° N, 7.4311337° E]"
    }
];

function parseLocation(locationString) {
    const match = locationString.match(/([0-9.\-]+)°\s*([NS]),\s*([0-9.\-]+)°\s*([EW])/);
    if (!match) {
        throw new Error(`Invalid location format: ${locationString}`);
    }
    let latitude = parseFloat(match[1]);
    let longitude = parseFloat(match[3]);

    // Adjust sign based on direction
    if (match[2] === 'S') latitude = -latitude;
    if (match[4] === 'W') longitude = -longitude;

    return [latitude, longitude];
}

async function restoreCentreDocuments(dataArray) {
    const batch = db.batch();

    for (const centre of dataArray) {
        const [latitude, longitude] = parseLocation(centre.centre_location);
        const geopoint = new admin.firestore.GeoPoint(latitude, longitude);
        const docRef = db.collection('cached_centres').doc(centre.centre_place_id);

        batch.set(docRef, {
            centre_name: centre.centre_name,
            centre_place_id: centre.centre_place_id,
            centre_location: geopoint
        });

        console.log(`Queued restoration for document with ID: ${centre.centre_place_id}`);
    }

    try {
        await batch.commit();
        console.log('Batch restoration completed successfully.');
    } catch (error) {
        console.error('Error during batch restoration:', error);
    }
}

restoreCentreDocuments(centreData).then(() => {
    console.log('Restoration process finished.');
}).catch(error => {
    console.error('An error occurred during the restoration process:', error);
});