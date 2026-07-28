require('dotenv').config();
const axios = require('axios');

async function testApi() {
  const API_KEY = process.env.GOOGLE_API_KEY;
  const CX = process.env.GOOGLE_CX;

  console.log('API_KEY:', API_KEY ? 'Present' : 'Missing');
  console.log('CX:', CX ? 'Present' : 'Missing');

  const query = `"pizzeria" "monterrey" ("@gmail.com" OR "@hotmail.com" OR "@yahoo.com" OR "@outlook.com")`;
  const url = `https://www.googleapis.com/customsearch/v1?key=${API_KEY}&cx=${CX}&q=${encodeURIComponent(query)}&num=10`;

  try {
    const { data } = await axios.get(url);
    console.log('Success! Items found:', data.items?.length || 0);
  } catch (error) {
    console.error('API Request Failed:', JSON.stringify(error.response?.data || error.message, null, 2));
  }
}

testApi();
