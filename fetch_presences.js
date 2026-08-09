
const url = "undefined/rest/v1/presences?select=*&limit=10";
fetch(url, {
  headers: {
    apikey: "undefined",
    Authorization: "Bearer undefined"
  }
}).then(r => r.json()).then(d => console.log(d)).catch(console.error);
