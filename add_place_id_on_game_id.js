const admin = require('firebase-admin');
const serviceAccount = require('./krank-club-firebase-adminsdk-bl4zy-d8facdf022.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'krank-club'
});

const db = admin.firestore();

const gameData = [
    {
        "game_id": "L7ArC6Y8kHMt5Ttd371m",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "mRthAKLV7ROxn6ftInSp",
        "place_id": "ChIJ02bKSuih6EcRb796CXVbkVs"
    },
    {
        "game_id": "7c1NCmgsO9qj4WOeesRf",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "js0diTE9z71v5DVx0e6s",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "iXDbgFDbXlxmheDbrhT0",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "GTXOifX01ycvlI0sJtZg",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "JWbOaWeHzZAW7AJUCU45",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "MEgQ5s1sy39Yp4ymkFXi",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "k2HmK4f391iWIOSkeyzm",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "A7Okjke7IYO7GMOihM3Q",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "IXmtLEbAZjbsL23YPt8t",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "YYU1C63GyuC7Vt62TKlx",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "ggQEZGlZP1WOTQKYZ9UM",
        "place_id": "ChIJ7eI8sFNv5kcR5xy52Wc57NU"
    },
    {
        "game_id": "xNTibg64EHRc4Eeih3hV",
        "place_id": "ChIJpVT4_n1u5kcRzji6FdTBXXo"
    },
    {
        "game_id": "RC70niSuan3qfLE5wF6w",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "5XiyhWQfjJI0AjCBMctk",
        "place_id": "ChIJi9oIzaRm5kcRJYcK7QsdRMU"
    },
    {
        "game_id": "vjm3S4BqWwPwrqjjerZV",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "HPeqKcF7eFMivNgmsbg3",
        "place_id": "ChIJIcEOcgsyyIcRdcrrXxtVdGg"
    },
    {
        "game_id": "6XnMacHgf2vprO9kDYSV",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "Pek5UWBq4IjLOvrDO2et",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "jF46uDRiidESAKfsBM3z",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "zoZ5dqOP3M82NH2Fnxub",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "jDw25qS5s2OinQcicQc2",
        "place_id": "ChIJbbOWFtC4yRIR0WXVerbWmnE"
    },
    {
        "game_id": "hWjdtkLfXJiPr4ykko6Y",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "hyXChwVACZ1U783JZr1t",
        "place_id": "ChIJbbOWFtC4yRIR0WXVerbWmnE"
    },
    {
        "game_id": "TsLr54VVjlsjftiBxlaF",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "PmgN4nPZNz2dgaxRfmbJ",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "lzZiByHdBZegvrt702fl",
        "place_id": "ChIJbbOWFtC4yRIR0WXVerbWmnE"
    },
    {
        "game_id": "clkcVNNVlVNVRSWp1Pn5",
        "place_id": "ChIJbbOWFtC4yRIR0WXVerbWmnE"
    },
    {
        "game_id": "Hmwxxhqx045wll4aE1O9",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "OxM2iIpAariIDLoDK3CG",
        "place_id": "ChIJIcEOcgsyyIcRdcrrXxtVdGg"
    },
    {
        "game_id": "gijaO3KbDlwwcmMu6uFa",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "0zJqgJSYB4GHXCDM430W",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "Aa0yZqM7kmZw1JDtH8hQ",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "hVPoB6B9w1Ekip1pAaJZ",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "cAZMRa9ozsbcpW9GzFgh",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "PHBxe8NreZprecWtXkwv",
        "place_id": "ChIJbbOWFtC4yRIR0WXVerbWmnE"
    },
    {
        "game_id": "d8i8t4Gao6QhEGZt2J4D",
        "place_id": "ChIJ02bKSuih6EcRb796CXVbkVs"
    },
    {
        "game_id": "oA9oiK1OTel6lv0chVIx",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "hvC3P8L2EgLGAdiDaAR5",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "3pzk5GjMAVcoPXEBaFEf",
        "place_id": "ChIJ_bOSChhz5kcRZMTeq_6Gdzg"
    },
    {
        "game_id": "9hyNF0CSI5C9cXglYN8C",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "VNocEw2obkkJBojhzFrJ",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "wMk9kTcfc6XgHouZy4Lk",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "A3ocBZQhSvTFy2ncPLsh",
        "place_id": "ChIJ7eI8sFNv5kcR5xy52Wc57NU"
    },
    {
        "game_id": "QsJcnBVeTU59cwsJiwMn",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "lrggR3lmvAhnBBk2RpJ8",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "sskPbc4dZ6MZ80mbRYXp",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "F2ZjlnBPKeymdQ8YK6aE",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "uTXr4OFRh5VTstwKTii0",
        "place_id": "ChIJpVT4_n1u5kcRzji6FdTBXXo"
    },
    {
        "game_id": "PQr9scOoyunGfASgkVCh",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "0YAo2lM8njK7g4JMbCCh",
        "place_id": "ChIJi2oG_jAxahoRjTdSH05-ixY"
    },
    {
        "game_id": "qzBxSUiJBkfZb8loBhrG",
        "place_id": "ChIJi9oIzaRm5kcRJYcK7QsdRMU"
    },
    {
        "game_id": "tZCv2qDLb0n5QrNp2AJM",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "7GI4jRy3VSTpzRGUPc6K",
        "place_id": "ChIJIcEOcgsyyIcRdcrrXxtVdGg"
    },
    {
        "game_id": "04CZXlaO6SgpKgjKxBsC",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "0dvQQhAwS5QZSC5wOfSb",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "3U4FH6lUnlvFV32DzQCx",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "puDp4notCZB7gyYdVza0",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "bsHHoE8n87KYE0FGjuCr",
        "place_id": "ChIJbbOWFtC4yRIR0WXVerbWmnE"
    },
    {
        "game_id": "NzXwImqQ4YwDnXMly1zv",
        "place_id": "ChIJbbOWFtC4yRIR0WXVerbWmnE"
    },
    {
        "game_id": "aqH0ti8p73l9tkOBdL4v",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "RrRmeHI2Hz9BbKVn12tt",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "FWObDO3ACuJUYcDLQNJb",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "5baG1RPniGSdWUFIU1SZ",
        "place_id": "ChIJbbOWFtC4yRIR0WXVerbWmnE"
    },
    {
        "game_id": "qWWNtVvS5APcXcFvFZuk",
        "place_id": "ChIJbbOWFtC4yRIR0WXVerbWmnE"
    },
    {
        "game_id": "iqy1Ft7CUGtfEpWXEYvp",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "611j9Pp6hIqmTB3SeHw2",
        "place_id": "ChIJIcEOcgsyyIcRdcrrXxtVdGg"
    },
    {
        "game_id": "gNiMkX0v7lpOSVfajPLT",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "5SYzW8jCZilGwmjxIcOG",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "acnbWWVJIjzUQT7E8Oaf",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "wmCOg5uvEwWW0miTAuki",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "HvXYvgiE9Qd18TchieGj",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "9lxDEydzvJESLQf1T7LQ",
        "place_id": "ChIJbbOWFtC4yRIR0WXVerbWmnE"
    },
    {
        "game_id": "K10LoIGjuW4oZEQnzRuG",
        "place_id": "ChIJ02bKSuih6EcRb796CXVbkVs"
    },
    {
        "game_id": "EY7FWLeh1iMAGkp2mxxS",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "sYNAMHEW4QYDAiNJzJZZ",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "8kib1vbLtl0RxZEC0oRa",
        "place_id": "ChIJ_bOSChhz5kcRZMTeq_6Gdzg"
    },
    {
        "game_id": "mPW4VMVV3HAVKsWkPRqU",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "kI8SN506Qf4TqIi658ML",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "e5BiNYRAKzxfee11KvGC",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "RgSDCjKfT8Co5IO6n3Ki",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "briL7lJXNO8mPRHJl11Q",
        "place_id": "ChIJ7eI8sFNv5kcR5xy52Wc57NU"
    },
    {
        "game_id": "dJxJju9AubGdHPfIBm2m",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "w1S3iWyqwKLQbYWxMhON",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "r56XbfveCyqDwbmVq5oq",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "2FXSHjO3FJzb5WWKaaAg",
        "place_id": "ChIJpVT4_n1u5kcRzji6FdTBXXo"
    },
    {
        "game_id": "1ZZ63RVzkaPlMiNSj9ll",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "IZHmWuPxuBFbES6cAGeL",
        "place_id": "ChIJi2oG_jAxahoRjTdSH05-ixY"
    },
    {
        "game_id": "A2Gp1klVzE6CN34qhgxL",
        "place_id": "ChIJi9oIzaRm5kcRJYcK7QsdRMU"
    },
    {
        "game_id": "51i0yReb2sn1553Ed2d1",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "fg964gqy0SsETRsO63sq",
        "place_id": "ChIJIcEOcgsyyIcRdcrrXxtVdGg"
    },
    {
        "game_id": "Dw3BvykC5gIzdaoqWJym",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "YRXXSUMOowbvfcTRbnHB",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "l7joMgbJwGRjcvfjqfuy",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "tkW9SpHGxlB5nmlnMty9",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "PSsFjzu0Fkf7cqgckqrh",
        "place_id": "ChIJbbOWFtC4yRIR0WXVerbWmnE"
    },
    {
        "game_id": "ko4wrVo3RQrH8aEPOMEU",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "rUAWMuXmisNBHLpVdCJX",
        "place_id": "ChIJbbOWFtC4yRIR0WXVerbWmnE"
    },
    {
        "game_id": "ShZL9uujYZKKK1qzbwGm",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "YML0mBPj6lx5yLduUvkB",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "j3wuERHGHfG6UqoVa08S",
        "place_id": "ChIJbbOWFtC4yRIR0WXVerbWmnE"
    },
    {
        "game_id": "HysPifcRCea1LLDoI5uv",
        "place_id": "ChIJbbOWFtC4yRIR0WXVerbWmnE"
    },
    {
        "game_id": "21ceJZVAF1WM0uZJWZQ8",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "A2tPk13ayckoKR7AdThY",
        "place_id": "ChIJIcEOcgsyyIcRdcrrXxtVdGg"
    },
    {
        "game_id": "fVI17wiy8WSUjlXnA3Ra",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "MWemOoYe8tNpdKEGMiAr",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "YL5gsZ1oNOopZpsBpbSn",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "Ze4xeDKHU4cBdd8fEQ32",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "ZUDi7jCQKXemV6ElRnc9",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "6CrWkoVck3QkG15yJlrD",
        "place_id": "ChIJbbOWFtC4yRIR0WXVerbWmnE"
    },
    {
        "game_id": "2GqI9JD5IkQXt8cqZc2F",
        "place_id": "ChIJ02bKSuih6EcRb796CXVbkVs"
    },
    {
        "game_id": "TWv32sidaeA3XPtikTWE",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "WdvUqNEDCxENFZSJB6rG",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "IjY4NfdNzjEXtIelWnuI",
        "place_id": "ChIJ_bOSChhz5kcRZMTeq_6Gdzg"
    },
    {
        "game_id": "Rr5SIy2MCwmhMZc7eTjq",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "DEOVWPn5oW5ftnqKCQP6",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "0XGSL2CrXzvta8g8wFJE",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "WFJxw8Xf40RkTdxi3I94",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "oKoISs0p61aR1fr3XcAy",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "4OcxsPDiaOufUp4Ol26K",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "AFnUYsQlCjTy0oR0h8gT",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "A9P4utEu4N5FE1xLAJIx",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "4LTSJA6xOzKRLjvblgFj",
        "place_id": "ChIJpVT4_n1u5kcRzji6FdTBXXo"
    },
    {
        "game_id": "Cgs1iFuodkEiayadyFZx",
        "place_id": "ChIJ88lx3VwL5kcRVxCh4lD6_Gk"
    },
    {
        "game_id": "F1ApyAoVfmcLKLzimzX8",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "KMPYTELqQr6tPWhY0QfB",
        "place_id": "ChIJ7eI8sFNv5kcR5xy52Wc57NU"
    },
    {
        "game_id": "X0GQPpnplCADKSA3kh4J",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "XIjhd5b0XaMxPaTJEenv",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "kJoT9PqaqwzXDqL0YTeg",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "t2XgxFcnT9ncsyr5o6Kd",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "uAuktDasEiExccMAwyIb",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "1vnIVu0TF97CiEhJV4R4",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "Vpzore4kHjZLKSwVk5eP",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "FeRWJCe6LQgi8lS7PgTB",
        "place_id": "ChIJ04KEHBZk5kcRoDWLaMOCCwQ"
    },
    {
        "game_id": "IHEg5x71u8Mv3GJP0dub",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "ME0dDQInBkbb9YN1JCR0",
        "place_id": "ChIJpVT4_n1u5kcRzji6FdTBXXo"
    },
    {
        "game_id": "AFcMZR4yysuKwmBD3taL",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "SaRby6TpscGrK5sPK1dN",
        "place_id": "ChIJ04KEHBZk5kcRoDWLaMOCCwQ"
    },
    {
        "game_id": "qXNAuLVXVAy0cgNyClz8",
        "place_id": "ChIJpVT4_n1u5kcRzji6FdTBXXo"
    },
    {
        "game_id": "tIPPv4yeUBbMZ8ZnWEAM",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "PCijR2k682C61Jxope0n",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "QrqiR4z6UGVzUOYv2KVY",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "RvqWa5fnRDSoPI4uzSTi",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "s4IcxSplZH7bE0nfM9P4",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "sBL1B64gOTcrKlN9UVXF",
        "place_id": "ChIJ_bOSChhz5kcRZMTeq_6Gdzg"
    },
    {
        "game_id": "3Jcbgyw4yHxCDxPV57AQ",
        "place_id": "ChIJi2oG_jAxahoRjTdSH05-ixY"
    },
    {
        "game_id": "Sgq7djYq3x3t0TgKQT0s",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "HDUXftU6Jfoay3JwutpS",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "IfHj5itJw533QLt2pyVA",
        "place_id": "ChIJi9oIzaRm5kcRJYcK7QsdRMU"
    },
    {
        "game_id": "iEaZcFWpzEGKX7vYFumm",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "dVjwdXVqZ53Ol4SgDp0J",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "D69zu7PYIjbRlKcHI69o",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "nhcfbDImw9gZYbnLOB51",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "PZrHsqztJoirtPR4LI32",
        "place_id": "ChIJIcEOcgsyyIcRdcrrXxtVdGg"
    },
    {
        "game_id": "ZbJVDpbSKiSW5pwbBPsk",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "Ca5iyjvyTutc7x289XG7",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "FpSCbEXvJPjP5rEO1shx",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "Uo6lhUktEsZOjKZjabML",
        "place_id": "ChIJ88lx3VwL5kcRVxCh4lD6_Gk"
    },
    {
        "game_id": "Zbc3I1OfJnKG5CE4AoGx",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "aExWlwy1cYPgHmbbmF5L",
        "place_id": "ChIJpVT4_n1u5kcRzji6FdTBXXo"
    },
    {
        "game_id": "blfyDZDjvHJuurUO0hz0",
        "place_id": "ChIJsXi1PLYN5kcRTVVDuczgS2s"
    },
    {
        "game_id": "ekLhIJgUQ2dvcOZgrdz3",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "pimFPrYjy7t3xu5sI77M",
        "place_id": "ChIJ7eI8sFNv5kcR5xy52Wc57NU"
    },
    {
        "game_id": "rRfESYd839dN3a1NLxlY",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "v546dNMQd0LItDLpB8xx",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "nhtLSdbSBIjm2wvEakzH",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "wC7CN3BMTcS8bt6F2GdG",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "uGWCAFTQXXZBPCZ1kSUD",
        "place_id": "ChIJ04KEHBZk5kcRoDWLaMOCCwQ"
    },
    {
        "game_id": "wvDgpdectdolrU4jZT1o",
        "place_id": "ChIJbbOWFtC4yRIR0WXVerbWmnE"
    },
    {
        "game_id": "02yHNwvm27xqIsmA4RcI",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "SRwA2byVPM5V7l3jjwWh",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "xfdh8rxAHDL1dIEH1mrW",
        "place_id": "ChIJ04KEHBZk5kcRoDWLaMOCCwQ"
    },
    {
        "game_id": "73hNdpb2yI6ZylPubliU",
        "place_id": "ChIJpVT4_n1u5kcRzji6FdTBXXo"
    },
    {
        "game_id": "6KhEYJkGGbU6ChF2QGd4",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "stJlpmuGmy41bOmijyil",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "6A6QiNhkjOeSYEH1RNgZ",
        "place_id": "ChIJ_bOSChhz5kcRZMTeq_6Gdzg"
    },
    {
        "game_id": "CA4Z4kFgpX7BrhtNpui8",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "px9pAkGfF7am126QdPyV",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "3XUoUkV524AgkT3fqfl7",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "42awMz1iRqJlCLvC5A2W",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "ejjuxcAjTrnH11B32Emm",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "gae1K0tmLDg0CnkK7Lmi",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "zFE7UjBPIYmmyLAXrrMk",
        "place_id": "ChIJbbOWFtC4yRIR0WXVerbWmnE"
    },
    {
        "game_id": "hN1m1OobuyjYxPOSqyPz",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "TJ1ONvqd5rooYCaegjc1",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "HPk1cI9D479l1t06qsCC",
        "place_id": "ChIJ88lx3VwL5kcRVxCh4lD6_Gk"
    },
    {
        "game_id": "Nc5zd4qinn4WbalWJD3M",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "qy6MPHAnpUejMpQmYL50",
        "place_id": "ChIJpVT4_n1u5kcRzji6FdTBXXo"
    },
    {
        "game_id": "rrPe59Bf2CX58QnA4Tum",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "tAocT9CLmP1Cg5Dcf137",
        "place_id": "ChIJ7eI8sFNv5kcR5xy52Wc57NU"
    },
    {
        "game_id": "zdocHyW4ij8PmJRTFjsy",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "Gxebq7scRVWs6RNO2MZp",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "JvnARhgqSMKozrPOTIaI",
        "place_id": "ChIJ04KEHBZk5kcRoDWLaMOCCwQ"
    },
    {
        "game_id": "Ob0HvVpoVggrmdHeIQs4",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "saM92U7DR0vYBbR7AdFz",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "mi4CPXHHMOFHxuZ7unA2",
        "place_id": "ChIJbbOWFtC4yRIR0WXVerbWmnE"
    },
    {
        "game_id": "F9VhHzX1fKNZXzQ4w0l6",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "5g6ulFT2CD8rxbclraIc",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "QCvqcHP6HIfMr0W1IvjA",
        "place_id": "ChIJ04KEHBZk5kcRoDWLaMOCCwQ"
    },
    {
        "game_id": "VaBxqdvb8UruGFUEisBH",
        "place_id": "ChIJpVT4_n1u5kcRzji6FdTBXXo"
    },
    {
        "game_id": "cuyigXBIGr1by1ms4kfi",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "U6odPcx8ssgYPgkNSkfP",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "UFoEg9RVTmZLRCu7krTX",
        "place_id": "ChIJ_bOSChhz5kcRZMTeq_6Gdzg"
    },
    {
        "game_id": "jVM4H1p2HUYbJJGBTxj9",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "5oANAsGCEG00Za3gucSx",
        "place_id": "ChIJbbOWFtC4yRIR0WXVerbWmnE"
    },
    {
        "game_id": "HPEanDNpdgthRGSBTsxp",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "LWkoISVd7NiRzUSEcMCd",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "rFvXZkX5MfUcTz8gX6bL",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "rmgKPwzK5Dmdy6p81Sgs",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "fYltN3TCvVrLGnHbf4aa",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "M0wx74L775vV2Y6oPtRD",
        "place_id": "ChIJ7eI8sFNv5kcR5xy52Wc57NU"
    },
    {
        "game_id": "efpKdsQYr2wPPLmuoJJT",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "ewokJomFyR4U0ElwpEOy",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "mRMv2OARI6Zd2vy4IPYk",
        "place_id": "ChIJpVT4_n1u5kcRzji6FdTBXXo"
    },
    {
        "game_id": "qYtAsigTMXMHbwOl8T64",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "zF3naQXoCTyQrnqQje7P",
        "place_id": "ChIJ88lx3VwL5kcRVxCh4lD6_Gk"
    },
    {
        "game_id": "7NyTn647B4c2GBuGYMzM",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "ly4qOIQdrqPnYbdPUx73",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "SZyMXl7n3a0jPRLyv0gB",
        "place_id": "ChIJsXi1PLYN5kcRTVVDuczgS2s"
    },
    {
        "game_id": "tCdP0IZiuHXHdwbSw0Qt",
        "place_id": "ChIJ04KEHBZk5kcRoDWLaMOCCwQ"
    },
    {
        "game_id": "gMy5BVjZ8Z0FOeF8as5a",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "H6z7fA3TlQ7ZSC77x9oe",
        "place_id": "ChIJIcEOcgsyyIcRdcrrXxtVdGg"
    },
    {
        "game_id": "Cl4cLLwHMUYyDLq7QcxS",
        "place_id": "ChIJ04KEHBZk5kcRoDWLaMOCCwQ"
    },
    {
        "game_id": "MQ37kNkTeLBFrIsSVB6M",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "OF04uRK1zeQd3vcK9XNr",
        "place_id": "ChIJpVT4_n1u5kcRzji6FdTBXXo"
    },
    {
        "game_id": "cP39awiiktmFfMJ183Pg",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "LNpU84JpyoWWB9RKNA2s",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "VjRvLF7g7HUDlojseczQ",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "h8Gpz92VL8UZAH2PuLfE",
        "place_id": "ChIJ_bOSChhz5kcRZMTeq_6Gdzg"
    },
    {
        "game_id": "kMypwtyz4sF8ImHaEmRN",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "S8vSeoHjitVgeWHpT0ot",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "kzMuD2YEnW78dXOBTHiS",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "wqA9A0ZxTSND2MmwTiYu",
        "place_id": "ChIJ04KEHBZk5kcRoDWLaMOCCwQ"
    },
    {
        "game_id": "9O8TvHMXzO4Zw7rY5Euu",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "Zlj8FDDlIvmWhCCWKBtN",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "L5cJUAZZRn8qnDQB0GDL",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "awc9OAvYpCKS3Tzd3V54",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "hqMdznqzSzSoAgJP0a42",
        "place_id": "ChIJi2oG_jAxahoRjTdSH05-ixY"
    },
    {
        "game_id": "dPaEmKZbekPXH5ewIyGR",
        "place_id": "ChIJi2oG_jAxahoRjTdSH05-ixY"
    },
    {
        "game_id": "GwCT2N4GOQnqEv6OFOsP",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "HYbOE28sTUBDLRjkeYRy",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "JxOvAxxzAp6Y6GTFRZl6",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "YD4DVjHUnz4T8Pr1prTe",
        "place_id": "ChIJpVT4_n1u5kcRzji6FdTBXXo"
    },
    {
        "game_id": "cCx5FYVlbLe9j8FuluzH",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "ergEtlWZ2dJI8xE44tU1",
        "place_id": "ChIJ7eI8sFNv5kcR5xy52Wc57NU"
    },
    {
        "game_id": "jyhZGCAYhdsVfHJTxEyL",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "wN7wH9BiHmXH2xBfMiUo",
        "place_id": "ChIJsXi1PLYN5kcRTVVDuczgS2s"
    },
    {
        "game_id": "yiRHWLJDtH47LzxNV9Iq",
        "place_id": "ChIJ88lx3VwL5kcRVxCh4lD6_Gk"
    },
    {
        "game_id": "CC4b0vZ8SbzYdRIPjKON",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "DTXrxtUPhgC9lnRlaU9O",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "fqLdQ3cGlSpwmCm6y2Mb",
        "place_id": "ChIJ04KEHBZk5kcRoDWLaMOCCwQ"
    },
    {
        "game_id": "x12ED5g2667ycDFt9Pth",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "L3NwgFDr9RC15WEdV3yW",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "fea4OwfyX7l4gvByLXTV",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "nIHktLWOEK4m432PDqTL",
        "place_id": "ChIJbbOWFtC4yRIR0WXVerbWmnE"
    },
    {
        "game_id": "57qUAwAHN4vOrZwrWyas",
        "place_id": "ChIJ02bKSuih6EcRb796CXVbkVs"
    },
    {
        "game_id": "rW9zkPbv19o65rRbkBuf",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "VUGQuSLWYKQea2gG0ATN",
        "place_id": "ChIJpVT4_n1u5kcRzji6FdTBXXo"
    },
    {
        "game_id": "DpufP7krgs42V2b9xOlp",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "EZTRXWg8v8b4Lodu3ZSM",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "UcCM4pHx3WpFTYqXYAGH",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "cT7oNtCbZKElT3L18v2a",
        "place_id": "ChIJ_bOSChhz5kcRZMTeq_6Gdzg"
    },
    {
        "game_id": "YlIdawhky7QKOH4cza7b",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "K76pBev3l3QqZHl7dI7A",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "cHYRsgFzSzM0xIYpn5s8",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "vb3w76ekiru60GbEw9R3",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "ReL9EladfsIyhsV1X6wH",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "cLQEhlnYkawtmwKbQJO3",
        "place_id": "ChIJi9oIzaRm5kcRJYcK7QsdRMU"
    },
    {
        "game_id": "sBr6Kst9tMVeHioaNz1x",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "n67e7QHQFvnOjsvt9eT1",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "nnWse8enl4cOP7zsXNDu",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "tGIhdCNBRk01vPjYmK3F",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "GkbbMlANxgwIXfgAeimH",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "pGgND0Ys3drl7Fxa7W73",
        "place_id": "ChIJGbxxaamUyRIRgGvhHnhJStA"
    },
    {
        "game_id": "j9YgSCPF4774kaggwVJi",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "sNF1EQ5MHUPBqNwT6Fbn",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "TXVz44g0VqJaKREnXn1C",
        "place_id": "ChIJsXi1PLYN5kcRTVVDuczgS2s"
    },
    {
        "game_id": "lSS81ZIT5CKGmRcnCzHe",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "Uinhy2rWqMZD4PfPtmXb",
        "place_id": "ChIJ04KEHBZk5kcRoDWLaMOCCwQ"
    },
    {
        "game_id": "X0pnrPpyhDJD1E5O1BKj",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "jd51J9dq9R0kns8tanfq",
        "place_id": "ChIJ_bOSChhz5kcRZMTeq_6Gdzg"
    },
    {
        "game_id": "zgN9yl5f0lHw9ftmU0Oi",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "XbsuI6ouElTrzmbrey9Q",
        "place_id": "ChIJpVT4_n1u5kcRzji6FdTBXXo"
    },
    {
        "game_id": "4jBe7dM09JQXX9vO7IAT",
        "place_id": "ChIJ2dHdMZxr5kcR0aKYHYsp0pY"
    },
    {
        "game_id": "ox2PEnCUYXKgpNIpM3d1",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "fdKb92UZZiLOuhjUq2KD",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "2zhwdQEJsqtGoQ7afQxy",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "dNKHTII0Zb9pMHYtlsKy",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "1gqnY3sKUOidtdB5K0to",
        "place_id": "ChIJfXprBx4b5kcRmhe-5pLZUek"
    },
    {
        "game_id": "cO6qm4pK0pTqEHQWWUwA",
        "place_id": "ChIJ88lx3VwL5kcRVxCh4lD6_Gk"
    },
    {
        "game_id": "e5v4k0K6h4hzTyEpdciu",
        "place_id": "ChIJi2oG_jAxahoRjTdSH05-ixY"
    },
    {
        "game_id": "pN8QvEKz7I0ZG0nPx7QI",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "vxtwBgcywjV8ynm1OiE0",
        "place_id": "ChIJJdTQjr0T5kcRZmGxtIJVy44"
    },
    {
        "game_id": "ra0zbP6l2AmdRuunfocj",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "P0hYvHcqsj41IXm0SNzZ",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "Q0HZvnRxpi86isJjGDcN",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "KmBXPPiNgXiRGMiGEJtO",
        "place_id": "ChIJGbxxaamUyRIRgGvhHnhJStA"
    },
    {
        "game_id": "PfRFuuhOiPm5HJG6vgXY",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "7AhR9yMsaUXne1O6BaFl",
        "place_id": "ChIJ04KEHBZk5kcRoDWLaMOCCwQ"
    },
    {
        "game_id": "Fvtm0eePx6DFxU5cumPV",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "U4EJ9q0qIzpbhZoRJuXn",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "jjycRAjuIYEq9h3SCMGA",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "JL1YDMhtKb6vmVK0BEKx",
        "place_id": "ChIJSSGxg-PUzRIRblID9ACQndc"
    },
    {
        "game_id": "idYeg7XSlodn04ZJGYWJ",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "F76kLt5vCj3LSMY3qED6",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "fvbEhKyoYsSXSHCqgPub",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "WyCHSdmye3fs6qHBQf5T",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "rqHNbU2aA1za56fFOqUG",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    },
    {
        "game_id": "Zlbn3BrFcNUUMWzgpKRk",
        "place_id": "ChIJ64X9jzx05kcRsHvSfOv6UcA"
    }
];

async function updateGameData() {
    for (const item of gameData) {
        const gameRef = db.collection('games').doc(item.game_id);

        try {
            await gameRef.update({ place_id: item.place_id });
            console.log(`Updated game ${item.game_id} with place_id: ${item.place_id}`);
        } catch (error) {
            console.error(`Error updating game ${item.game_id}:`, error);
        }
    }
}

updateGameData().then(() => {
    console.log('All games updated successfully.');
}).catch(error => {
    console.error('Error updating games:', error);
});
