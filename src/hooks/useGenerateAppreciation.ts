import { supabase } from "@/lib/supabase";

export interface ContexteEleve {
  prenom: string;
  nom: string;
  matiere: string;
  moyenne: number;
  moyennePrecedente: number | null;
  rang: number;
  effectif: number;
  mention: string;
}

export function useGenerateAppreciation() {
  const generer = async (contexteEleve: ContexteEleve) => {
    const { data, error } = await supabase.functions.invoke(
      "generer-appreciation",
      { body: contexteEleve }
    );

    if (error) {
      console.error("Erreur lors de l'appel à la fonction Edge:", error);
      throw error;
    }

    if (data && data.error) {
      console.error("Erreur retournée par la fonction:", data.error);
      throw new Error(data.error);
    }

    return data.appreciation as string;
  };

  return { generer };
}
