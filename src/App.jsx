import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import "./App.css";

const BUCKET = "pieces-identite";
const NOM_CATEGORIE = { moto: "Moto", eco: "Éco", confort: "Confort", confortplus: "Confort+" };

/* ===================== CONNEXION ADMIN ===================== */
function Connexion() {
  const [email, setEmail] = useState("");
  const [mdp, setMdp] = useState("");
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState(null);

  async function seConnecter() {
    setErreur(null);
    if (!email.trim() || !mdp.trim()) { setErreur("Email et mot de passe requis."); return; }
    setChargement(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: mdp });
    setChargement(false);
    if (error) setErreur("Identifiants incorrects.");
  }

  return (
    <div className="admin-login">
      <div className="admin-login-carte">
        <h1>NDjam Ride<br /><span>Administration</span></h1>
        <p>Vérification des chauffeurs</p>
        <input type="email" placeholder="Email admin" value={email}
          onChange={(e) => setEmail(e.target.value)} className="admin-input" />
        <input type="password" placeholder="Mot de passe" value={mdp}
          onChange={(e) => setMdp(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") seConnecter(); }} className="admin-input" />
        {erreur && <div className="admin-erreur">{erreur}</div>}
        <button className="admin-btn" onClick={seConnecter} disabled={chargement}>
          {chargement ? "Connexion..." : "Se connecter"}
        </button>
      </div>
    </div>
  );
}

/* ===================== CARTE D'UN CHAUFFEUR ===================== */
function CarteChauffeur({ chauffeur, onAction }) {
  const [piece, setPiece] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [traitement, setTraitement] = useState(false);

  useEffect(() => {
    (async () => {
      if (chauffeur.piece_identite_url) {
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(chauffeur.piece_identite_url, 600);
        if (data) setPiece(data.signedUrl);
      }
      if (chauffeur.selfie_url) {
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(chauffeur.selfie_url, 600);
        if (data) setSelfie(data.signedUrl);
      }
    })();
  }, [chauffeur]);

  async function definirStatut(statut) {
    setTraitement(true);
    await supabase.from("chauffeurs").update({ statut_verif: statut }).eq("user_id", chauffeur.user_id);
    setTraitement(false);
    onAction();
  }

  const badge = {
    en_attente: { txt: "En attente", bg: "#fef3c7", col: "#92400e" },
    approuve: { txt: "Approuvé", bg: "#dcfce7", col: "#166534" },
    rejete: { txt: "Rejeté", bg: "#fee2e2", col: "#991b1b" },
  }[chauffeur.statut_verif] || { txt: chauffeur.statut_verif, bg: "#eee", col: "#333" };

  return (
    <div className="ch-carte">
      <div className="ch-haut">
        <div>
          <div className="ch-nom">{chauffeur.nom}</div>
          <div className="ch-meta">{chauffeur.vehicule} · {chauffeur.plaque}</div>
          <div className="ch-meta">📞 {chauffeur.telephone} · {NOM_CATEGORIE[chauffeur.categorie] || chauffeur.categorie}</div>
        </div>
        <div className="ch-badge" style={{ background: badge.bg, color: badge.col }}>{badge.txt}</div>
      </div>

      <div className="ch-images">
        <div className="ch-img-bloc">
          <div className="ch-img-titre">Pièce d'identité</div>
          {piece ? <img src={piece} alt="Pièce" className="ch-img" /> : <div className="ch-img-vide">Pas de pièce</div>}
        </div>
        <div className="ch-img-bloc">
          <div className="ch-img-titre">Selfie</div>
          {selfie ? <img src={selfie} alt="Selfie" className="ch-img" /> : <div className="ch-img-vide">Pas de selfie</div>}
        </div>
      </div>

      <div className="ch-actions">
        {chauffeur.statut_verif !== "approuve" && (
          <button className="ch-btn approuver" onClick={() => definirStatut("approuve")} disabled={traitement}>
            ✓ Approuver
          </button>
        )}
        {chauffeur.statut_verif !== "rejete" && (
          <button className="ch-btn rejeter" onClick={() => definirStatut("rejete")} disabled={traitement}>
            ✕ Rejeter
          </button>
        )}
      </div>
    </div>
  );
}

/* ===================== APP ADMIN ===================== */
export default function App() {
  const [session, setSession] = useState(null);
  const [authPrete, setAuthPrete] = useState(false);
  const [chauffeurs, setChauffeurs] = useState([]);
  const [filtre, setFiltre] = useState("en_attente"); // en_attente | approuve | rejete | tous
  const [chargement, setChargement] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthPrete(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function chargerChauffeurs() {
    setChargement(true);
    let req = supabase.from("chauffeurs").select("*").order("cree_le", { ascending: false });
    if (filtre !== "tous") req = req.eq("statut_verif", filtre);
    const { data } = await req;
    setChauffeurs(data || []);
    setChargement(false);
  }

  useEffect(() => {
    if (session) chargerChauffeurs();
  }, [session, filtre]);

  async function deconnexion() {
    await supabase.auth.signOut();
    setChauffeurs([]);
  }

  if (!authPrete) {
    return <div className="admin-vide">Chargement...</div>;
  }
  if (!session) {
    return <Connexion />;
  }

  const FILTRES = [
    { id: "en_attente", nom: "En attente" },
    { id: "approuve", nom: "Approuvés" },
    { id: "rejete", nom: "Rejetés" },
    { id: "tous", nom: "Tous" },
  ];

  return (
    <div className="admin-app">
      <div className="admin-header">
        <h1>NDjam Ride <span>Admin</span></h1>
        <button className="admin-deco" onClick={deconnexion}>Déconnexion</button>
      </div>

      <div className="admin-filtres">
        {FILTRES.map((f) => (
          <button key={f.id}
            className={"admin-filtre" + (filtre === f.id ? " actif" : "")}
            onClick={() => setFiltre(f.id)}>
            {f.nom}
          </button>
        ))}
      </div>

      <div className="admin-liste">
        {chargement ? (
          <div className="admin-vide">Chargement...</div>
        ) : chauffeurs.length === 0 ? (
          <div className="admin-vide">Aucun chauffeur dans cette catégorie.</div>
        ) : (
          chauffeurs.map((ch) => (
            <CarteChauffeur key={ch.user_id} chauffeur={ch} onAction={chargerChauffeurs} />
          ))
        )}
      </div>
    </div>
  );
}
