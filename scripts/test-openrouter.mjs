import { config } from "dotenv";
config();

const key = process.env.OPENROUTER_API_KEY;
console.log("Key set:", !!key, "| Length:", key?.length);

const res = await fetch("https://openrouter.ai/api/v1/models", {
  headers: { Authorization: "Bearer " + key },
});
console.log("Status:", res.status);
const data = await res.json();
const models = data.data?.slice(0, 3).map((m) => m.id);
console.log("Sample models:", models);
console.log("API KEY VALID:", res.status === 200);
