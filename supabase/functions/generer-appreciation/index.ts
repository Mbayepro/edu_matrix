// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

serve(async (req: Request) => {
  // Gestion du CORS pour les requêtes OPTIONS (prévol)
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      prenom,
      nom,
      matiere,
      moyenne,
      moyennePrecedente,
      rang,
      effectif,
      mention,
    } = await req.json();

    // Calcul de la progression pour donner plus de contexte à l'IA
    const progression =
      moyennePrecedente !== null && moyennePrecedente !== undefined
        ? moyenne > moyennePrecedente
          ? `en progression de +${(moyenne - moyennePrecedente).toFixed(1)} pts`
          : moyenne < moyennePrecedente
          ? `en baisse de ${(moyennePrecedente - moyenne).toFixed(1)} pts`
          : "stable par rapport au trimestre précédent"
        : null;

    const prompt = `Tu es un enseignant expérimenté dans le système scolaire sénégalais.
Rédige une appréciation de bulletin scolaire en français, bienveillante et précise, en 2 phrases maximum.

Contexte :
- Élève : ${prenom} ${nom}
- Matière : ${matiere}
- Moyenne ce trimestre : ${moyenne}/20
${progression ? `- Progression : ${progression}` : ""}
- Rang dans la classe : ${rang}/${effectif}
- Mention : ${mention}

Règles strictes :
- Ton encourageant même pour les faibles résultats
- Mentionner la progression si elle est positive
- Suggérer un axe d'amélioration concret si moyenne < 10
- Ne jamais répéter les chiffres bruts déjà visibles sur le bulletin (pas de "avec 15/20")
- Maximum 2 phrases, style professionnel`;

    const apiKey = Deno.env.get("CLAUDE_API_KEY");
    if (!apiKey) {
      throw new Error("CLAUDE_API_KEY is not set in environment variables");
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001", // Le modèle correct et économique
        max_tokens: 150,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erreur API Anthropic:", errorText);
      throw new Error("Erreur lors de l'appel à l'API Claude");
    }

    const data = await response.json();
    const appreciation = data.content[0].text;

    return new Response(JSON.stringify({ appreciation }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
