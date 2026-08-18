const axios = require('axios');
const Table = require('cli-table3');

const countries = [
    { name: 'United States', lat: 37.7749, lng: -122.4194 },
    { name: 'China', lat: 39.9042, lng: 116.4074 },
    { name: 'Japan', lat: 35.6895, lng: 139.6917 },
    { name: 'Germany', lat: 52.5200, lng: 13.4050 },
    { name: 'United Kingdom', lat: 51.5074, lng: -0.1278 },
    { name: 'India', lat: 28.6139, lng: 77.2090 },
    { name: 'France', lat: 48.8566, lng: 2.3522 },
    { name: 'Italy', lat: 41.9028, lng: 12.4964 },
    { name: 'Canada', lat: 45.4215, lng: -75.6972 },
    { name: 'South Korea', lat: 37.5665, lng: 126.9780 },
    { name: 'Russia', lat: 55.7558, lng: 37.6173 },
    { name: 'Australia', lat: -33.8688, lng: 151.2093 },
    { name: 'Spain', lat: 40.4168, lng: -3.7038 },
    { name: 'Mexico', lat: 19.4326, lng: -99.1332 },
    { name: 'Indonesia', lat: -6.2088, lng: 106.8456 },
    { name: 'Netherlands', lat: 52.3676, lng: 4.9041 },
    { name: 'Saudi Arabia', lat: 24.7136, lng: 46.6753 },
    { name: 'Turkey', lat: 39.9334, lng: 32.8597 },
    { name: 'Switzerland', lat: 46.9481, lng: 7.4474 },
    { name: 'Taiwan', lat: 25.0330, lng: 121.5654 },
    { name: 'Sweden', lat: 59.3293, lng: 18.0686 },
    { name: 'Poland', lat: 52.2297, lng: 21.0122 },
    { name: 'Belgium', lat: 50.8503, lng: 4.3517 },
    { name: 'Thailand', lat: 13.7563, lng: 100.5018 },
    { name: 'Argentina', lat: -34.6037, lng: -58.3816 },
    { name: 'Norway', lat: 59.9139, lng: 10.7522 },
    { name: 'Austria', lat: 48.2082, lng: 16.3738 },
    { name: 'United Arab Emirates', lat: 25.2048, lng: 55.2708 },
    { name: 'Israel', lat: 31.7683, lng: 35.2137 },
    { name: 'South Africa', lat: -25.7479, lng: 28.2293 },
];

async function getCountryCodeAndCurrency(lat, lng) {
    try {
        const geoResponse = await axios.get(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`);
        const countryCode = geoResponse.data.countryCode;

        if (!countryCode) {
            return { countryCode: null, currencyCode: null };
        }

        const countryResponse = await axios.get(`https://restcountries.com/v3.1/alpha/${countryCode}`);
        const currencyCodes = countryResponse.data[0]?.currencies;
        const currencyCode = currencyCodes ? Object.keys(currencyCodes)[0] : null;

        return { countryCode, currencyCode };
    } catch (error) {
        console.error('Error fetching data:', error);
        return { countryCode: null, currencyCode: null };
    }
}

(async () => {
    const table = new Table({
        head: ['Country Name', 'Lat & Lng', 'Country Code', 'Currency Code'],
        colWidths: [20, 25, 15, 15],
    });

    for (const country of countries) {
        const { name, lat, lng } = country;
        const { countryCode, currencyCode } = await getCountryCodeAndCurrency(lat, lng);
        table.push([name, `${lat}, ${lng}`, countryCode || 'N/A', currencyCode || 'N/A']);
    }

    console.log(table.toString());
})();
