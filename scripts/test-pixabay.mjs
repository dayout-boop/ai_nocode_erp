import { config } from 'dotenv';
config();

const key = process.env.PIXABAY_API_KEY;
console.log('Key exists:', !!key, key ? `(length: ${key.length})` : '');

if (!key) {
  console.error('PIXABAY_API_KEY not found');
  process.exit(1);
}

const url = `https://pixabay.com/api/?key=${key}&q=golf+course&image_type=photo&per_page=3&lang=ko`;
const res = await fetch(url);
const data = await res.json();

if (data.error) {
  console.error('API Error:', data.error);
  process.exit(1);
}

console.log('Total hits:', data.totalHits);
console.log('First image URL:', data.hits?.[0]?.webformatURL);
console.log('Pixabay API test PASSED');
