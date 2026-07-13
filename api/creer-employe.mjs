import { createClient } from "@supabase/supabase-js";

// Cette fonction tourne côté serveur (Vercel), jamais dans le navigateur.
// Les variables SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont lues depuis
// les variables d'environnement Vercel — jamais depuis le code, jamais
// préfixées par VITE_ (ce préfixe les enverrait dans le bundle du navigateur).
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Méthode non autorisée." });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: "Configuration serveur incomplète (variables d'environnement manquantes)." });
    return;
  }
  const admin = createClient(supabaseUrl, serviceKey);

  // 1) Vérifier que l'appelant est authentifié
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) {
    res.status(401).json({ error: "Non authentifié." });
    return;
  }
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) {
    res.status(401).json({ error: "Session invalide, reconnectez-vous." });
    return;
  }

  // 2) Vérifier que l'appelant est bien un DG actif dans la table admins
  const { data: monAdmin } = await admin
    .from("admins")
    .select("*")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (!monAdmin || monAdmin.role !== "dg" || monAdmin.actif === false) {
    res.status(403).json({ error: "Réservé au directeur général." });
    return;
  }

  // 3) Valider les données envoyées
  const { nom, email, role } = req.body || {};
  if (!nom || !nom.trim() || !email || !email.trim()) {
    res.status(400).json({ error: "Nom et email requis." });
    return;
  }
  if (role !== "dg" && role !== "employe") {
    res.status(400).json({ error: "Rôle invalide." });
    return;
  }

  // 4) Générer un mot de passe temporaire (le DG le communique à la personne)
  const motDePasse =
    Math.random().toString(36).slice(-5) + Math.random().toString(36).slice(-5).toUpperCase() + "!";

  // 5) Créer le compte Supabase Auth (déjà confirmé, pas d'email à valider)
  const { data: nouvelUtilisateur, error: creationErr } = await admin.auth.admin.createUser({
    email: email.trim(),
    password: motDePasse,
    email_confirm: true,
  });
  if (creationErr) {
    res.status(400).json({ error: creationErr.message });
    return;
  }

  // 6) L'ajouter dans la table admins avec son rôle
  const { error: insertErr } = await admin.from("admins").insert({
    user_id: nouvelUtilisateur.user.id,
    email: email.trim(),
    nom: nom.trim(),
    role,
    actif: true,
  });
  if (insertErr) {
    // Le compte Auth a été créé mais l'insertion a échoué : on le supprime pour rester cohérent.
    await admin.auth.admin.deleteUser(nouvelUtilisateur.user.id);
    res.status(400).json({ error: "Échec de l'enregistrement : " + insertErr.message });
    return;
  }

  res.status(200).json({ email: email.trim(), motDePasse });
}
