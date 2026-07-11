import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import "./App.css";

const BUCKET = "pieces-identite";
const NOM_CATEGORIE = { moto: "Moto", eco: "Éco", confort: "Confort", confortplus: "Confort+" };
const PAY_NOMS = { airtel: "Airtel Money", moov: "Moov Money", cash: "Espèces" };

/* ===================== LOGO MIRA EXPRESS ===================== */
function LogoMiraExpress() {
  return (
    <svg className="me-logo" width="92" height="92" viewBox="0 0 92 92" xmlns="http://www.w3.org/2000/svg">
      {/* rond bleu + contour jaune */}
      <circle cx="46" cy="46" r="44" fill="#002664" />
      <circle cx="46" cy="46" r="44" fill="none" stroke="#FECB00" strokeWidth="3" />
      {/* route jaune en S */}
      <path d="M34 70 Q22 46 50 42 Q78 38 58 14" stroke="#FECB00" strokeWidth="5"
        fill="none" strokeLinecap="round" />
      {/* point de départ (blanc) */}
      <circle cx="34" cy="70" r="7" fill="#ffffff" />
      {/* point d'arrivée (rouge) */}
      <circle cx="58" cy="14" r="7" fill="#C60C30" />
    </svg>
  );
}

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
        <LogoMiraExpress />
        <h1>Mira <span>Express</span></h1>
        <p>Administration</p>
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

/* ===================== COURSES D'UN CHAUFFEUR (panneau dépliable) ===================== */
function CoursesChauffeur({ nom }) {
  const [courses, setCourses] = useState(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("courses").select("*")
        .eq("chauffeur_nom", nom)
        .order("cree_le", { ascending: false })
        .limit(20);
      setCourses(data || []);
    })();
  }, [nom]);

  if (courses === null) return <div className="ch-courses-vide">Chargement des courses…</div>;
  if (courses.length === 0) return <div className="ch-courses-vide">Aucune course pour ce chauffeur.</div>;

  const STATUT_LABEL = {
    terminee: { txt: "Terminée", col: "#166534", bg: "#dcfce7" },
    acceptee: { txt: "En cours", col: "#92400e", bg: "#fef3c7" },
    annulee: { txt: "Annulée", col: "#991b1b", bg: "#fee2e2" },
    recherche: { txt: "Recherche", col: "#1e40af", bg: "#dbeafe" },
    expiree: { txt: "Expirée", col: "#6b7280", bg: "#f3f4f6" },
  };

  return (
    <div className="ch-courses">
      {courses.map((c) => {
        const s = STATUT_LABEL[c.statut] || { txt: c.statut, col: "#333", bg: "#eee" };
        return (
          <div key={c.id} className="ch-course-ligne">
            <div>
              <div className="ch-course-prix">{(c.prix_fcfa || 0).toLocaleString("fr-FR")} FCFA</div>
              <div className="ch-course-meta">
                {NOM_CATEGORIE[c.classe] || c.classe} · {c.distance_km} km · {PAY_NOMS[c.mode_paiement] || c.mode_paiement}
              </div>
            </div>
            <div className="ch-course-statut" style={{ background: s.bg, color: s.col }}>{s.txt}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ===================== CARTE D'UN CHAUFFEUR ===================== */
function CarteChauffeur({ chauffeur, onAction }) {
  const [piece, setPiece] = useState(null);
  const [selfie, setSelfie] = useState(null);
  const [traitement, setTraitement] = useState(false);
  const [voirCourses, setVoirCourses] = useState(false);

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

  // Suspendre / bloquer / réactiver. Si on suspend ou bloque, on force aussi hors ligne.
  async function definirCompte(statutCompte) {
    setTraitement(true);
    const maj = { statut_compte: statutCompte };
    if (statutCompte !== "actif") { maj.en_ligne = false; maj.en_course = false; }
    await supabase.from("chauffeurs").update(maj).eq("user_id", chauffeur.user_id);
    setTraitement(false);
    onAction();
  }

  const badge = {
    en_attente: { txt: "En attente", bg: "#fef3c7", col: "#92400e" },
    approuve: { txt: "Approuvé", bg: "#dcfce7", col: "#166534" },
    rejete: { txt: "Rejeté", bg: "#fee2e2", col: "#991b1b" },
  }[chauffeur.statut_verif] || { txt: chauffeur.statut_verif, bg: "#eee", col: "#333" };

  const compte = chauffeur.statut_compte || "actif";
  const badgeCompte = {
    suspendu: { txt: "⏸ Suspendu", bg: "#ffedd5", col: "#9a3412" },
    bloque: { txt: "⛔ Bloqué", bg: "#fee2e2", col: "#991b1b" },
  }[compte];

  return (
    <div className="ch-carte">
      <div className="ch-haut">
        <div>
          <div className="ch-nom">{chauffeur.nom}</div>
          <div className="ch-meta">{chauffeur.vehicule} · {chauffeur.plaque}</div>
          <div className="ch-meta">📞 {chauffeur.telephone} · {NOM_CATEGORIE[chauffeur.categorie] || chauffeur.categorie}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
          <div className="ch-badge" style={{ background: badge.bg, color: badge.col }}>{badge.txt}</div>
          {badgeCompte && <div className="ch-badge" style={{ background: badgeCompte.bg, color: badgeCompte.col }}>{badgeCompte.txt}</div>}
          {chauffeur.en_ligne && <div className="ch-badge" style={{ background: "#dcfce7", color: "#16a34a" }}>🟢 En ligne</div>}
        </div>
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

      {/* Vérification (approuver / rejeter) */}
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

      {/* Gestion du compte (suspendre / bloquer / réactiver) */}
      <div className="ch-actions" style={{ marginTop: "8px" }}>
        {compte === "actif" ? (
          <>
            <button className="ch-btn" onClick={() => definirCompte("suspendu")} disabled={traitement}
              style={{ background: "#f97316", color: "#fff" }}>
              ⏸ Suspendre
            </button>
            <button className="ch-btn" onClick={() => definirCompte("bloque")} disabled={traitement}
              style={{ background: "#7f1d1d", color: "#fff" }}>
              ⛔ Bloquer
            </button>
          </>
        ) : (
          <button className="ch-btn approuver" onClick={() => definirCompte("actif")} disabled={traitement}>
            ✓ Réactiver le compte
          </button>
        )}
      </div>

      <button className="ch-voir-courses" onClick={() => setVoirCourses(!voirCourses)}>
        {voirCourses ? "▲ Masquer les courses" : "▼ Voir les courses"}
      </button>
      {voirCourses && <CoursesChauffeur nom={chauffeur.nom} />}
    </div>
  );
}

/* ===================== ONGLET CHAUFFEURS ===================== */
function OngletChauffeurs() {
  const [chauffeurs, setChauffeurs] = useState([]);
  const [filtre, setFiltre] = useState("en_attente");
  const [chargement, setChargement] = useState(false);

  async function chargerChauffeurs() {
    setChargement(true);
    let req = supabase.from("chauffeurs").select("*").order("cree_le", { ascending: false });
    if (filtre === "en_attente" || filtre === "approuve" || filtre === "rejete") {
      req = req.eq("statut_verif", filtre);
    } else if (filtre === "suspendu") {
      req = req.eq("statut_compte", "suspendu");
    } else if (filtre === "bloque") {
      req = req.eq("statut_compte", "bloque");
    }
    const { data } = await req;
    setChauffeurs(data || []);
    setChargement(false);
  }

  useEffect(() => { chargerChauffeurs(); }, [filtre]);

  const FILTRES = [
    { id: "en_attente", nom: "En attente" },
    { id: "approuve", nom: "Approuvés" },
    { id: "rejete", nom: "Rejetés" },
    { id: "suspendu", nom: "Suspendus" },
    { id: "bloque", nom: "Bloqués" },
    { id: "tous", nom: "Tous" },
  ];

  return (
    <>
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
    </>
  );
}

/* ===================== ONGLET TARIFS & COMMISSION ===================== */
function ChampTarif({ label, suffixe, valeur, onChange }) {
  return (
    <div className="tf-champ">
      <label className="tf-label">{label}</label>
      <div className="tf-input-zone">
        <input
          type="number"
          className="tf-input"
          value={valeur}
          onChange={(e) => onChange(e.target.value)}
        />
        {suffixe && <span className="tf-suffixe">{suffixe}</span>}
      </div>
    </div>
  );
}

function OngletTarifs() {
  const [tarifs, setTarifs] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [enreg, setEnreg] = useState(false);
  const [message, setMessage] = useState(null);
  const [erreur, setErreur] = useState(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("tarifs").select("*").eq("id", 1).maybeSingle();
      if (error) { setErreur("Impossible de charger les tarifs : " + error.message); setChargement(false); return; }
      setTarifs(data);
      setChargement(false);
    })();
  }, []);

  function maj(champ, valeur) {
    setTarifs((prev) => ({ ...prev, [champ]: valeur }));
    setMessage(null);
  }

  async function enregistrer() {
    setErreur(null); setMessage(null);
    setEnreg(true);
    const champsNum = [
      "moto_km", "moto_min", "eco_km", "eco_min", "confort_km", "confort_min",
      "confortplus_km", "confortplus_min", "supplement_pointe",
      "colis_petit", "colis_moyen", "colis_grand", "colis_km",
      "commission_course", "commission_colis",
    ];
    const majObj = { maj_le: new Date().toISOString() };
    for (const c of champsNum) {
      const n = parseFloat(tarifs[c]);
      if (isNaN(n) || n < 0) { setErreur(`Valeur invalide pour « ${c} ».`); setEnreg(false); return; }
      majObj[c] = n;
    }
    const { error } = await supabase.from("tarifs").update(majObj).eq("id", 1);
    setEnreg(false);
    if (error) { setErreur("Échec de l'enregistrement : " + error.message); return; }
    setMessage("✓ Tarifs enregistrés. Ils s'appliquent aux nouvelles commandes.");
  }

  if (chargement) return <div className="admin-vide">Chargement des tarifs…</div>;
  if (!tarifs) return <div className="admin-vide">{erreur || "Aucun tarif trouvé. Vérifiez la table tarifs."}</div>;

  return (
    <div className="tf-wrap">
      {/* COURSES */}
      <div className="tf-section">
        <div className="tf-section-titre">🚗 Tarifs des courses</div>
        <div className="tf-grille">
          <div className="tf-cat-titre">Moto 🛵</div>
          <ChampTarif label="Prix par km" suffixe="F" valeur={tarifs.moto_km} onChange={(v) => maj("moto_km", v)} />
          <ChampTarif label="Minimum" suffixe="F" valeur={tarifs.moto_min} onChange={(v) => maj("moto_min", v)} />

          <div className="tf-cat-titre">Éco 🚗</div>
          <ChampTarif label="Prix par km" suffixe="F" valeur={tarifs.eco_km} onChange={(v) => maj("eco_km", v)} />
          <ChampTarif label="Minimum" suffixe="F" valeur={tarifs.eco_min} onChange={(v) => maj("eco_min", v)} />

          <div className="tf-cat-titre">Confort 🚙</div>
          <ChampTarif label="Prix par km" suffixe="F" valeur={tarifs.confort_km} onChange={(v) => maj("confort_km", v)} />
          <ChampTarif label="Minimum" suffixe="F" valeur={tarifs.confort_min} onChange={(v) => maj("confort_min", v)} />

          <div className="tf-cat-titre">Confort+ 🚘</div>
          <ChampTarif label="Prix par km" suffixe="F" valeur={tarifs.confortplus_km} onChange={(v) => maj("confortplus_km", v)} />
          <ChampTarif label="Minimum" suffixe="F" valeur={tarifs.confortplus_min} onChange={(v) => maj("confortplus_min", v)} />
        </div>
        <div className="tf-note">
          Supplément heure de pointe (7h-9h et 17h-19h). Exemple : 1.2 = +20%.
        </div>
        <ChampTarif label="Multiplicateur heure de pointe" suffixe="×" valeur={tarifs.supplement_pointe} onChange={(v) => maj("supplement_pointe", v)} />
      </div>

      {/* COLIS */}
      <div className="tf-section">
        <div className="tf-section-titre">📦 Tarifs des colis</div>
        <div className="tf-grille">
          <ChampTarif label="Base petit colis" suffixe="F" valeur={tarifs.colis_petit} onChange={(v) => maj("colis_petit", v)} />
          <ChampTarif label="Base colis moyen" suffixe="F" valeur={tarifs.colis_moyen} onChange={(v) => maj("colis_moyen", v)} />
          <ChampTarif label="Base grand colis" suffixe="F" valeur={tarifs.colis_grand} onChange={(v) => maj("colis_grand", v)} />
          <ChampTarif label="Prix par km" suffixe="F" valeur={tarifs.colis_km} onChange={(v) => maj("colis_km", v)} />
        </div>
      </div>

      {/* COMMISSION */}
      <div className="tf-section">
        <div className="tf-section-titre">💰 Commission Mira Express</div>
        <div className="tf-note">
          Part prélevée par la plateforme sur chaque commande. Le reste revient au chauffeur.
        </div>
        <div className="tf-grille">
          <ChampTarif label="Commission sur les courses" suffixe="%" valeur={tarifs.commission_course} onChange={(v) => maj("commission_course", v)} />
          <ChampTarif label="Commission sur les colis" suffixe="%" valeur={tarifs.commission_colis} onChange={(v) => maj("commission_colis", v)} />
        </div>
      </div>

      {erreur && <div className="tf-erreur">{erreur}</div>}
      {message && <div className="tf-succes">{message}</div>}

      <button className="tf-enregistrer" onClick={enregistrer} disabled={enreg}>
        {enreg ? "Enregistrement…" : "Enregistrer les tarifs"}
      </button>
    </div>
  );
}

/* ===================== ONGLET COLIS ===================== */
function OngletColis() {
  const [colis, setColis] = useState([]);
  const [filtre, setFiltre] = useState("recherche");
  const [chargement, setChargement] = useState(false);

  async function chargerColis() {
    setChargement(true);
    let req = supabase.from("colis").select("*").order("cree_le", { ascending: false });
    if (filtre !== "tous") req = req.eq("statut", filtre);
    const { data } = await req;
    setColis(data || []);
    setChargement(false);
  }

  useEffect(() => { chargerColis(); }, [filtre]);

  const FILTRES = [
    { id: "recherche", nom: "En recherche" },
    { id: "acceptee", nom: "En cours" },
    { id: "livre", nom: "Livrés" },
    { id: "annulee", nom: "Annulés" },
    { id: "tous", nom: "Tous" },
  ];

  const STATUT_LABEL = {
    livre: { txt: "Livré", col: "#166534", bg: "#dcfce7" },
    acceptee: { txt: "En cours", col: "#92400e", bg: "#fef3c7" },
    annulee: { txt: "Annulé", col: "#991b1b", bg: "#fee2e2" },
    recherche: { txt: "Recherche", col: "#1e40af", bg: "#dbeafe" },
    expiree: { txt: "Expiré", col: "#6b7280", bg: "#f3f4f6" },
  };

  return (
    <>
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
        ) : colis.length === 0 ? (
          <div className="admin-vide">Aucun colis dans cette catégorie.</div>
        ) : (
          colis.map((c) => {
            const s = STATUT_LABEL[c.statut] || { txt: c.statut, col: "#333", bg: "#eee" };
            return (
              <div key={c.id} className="colis-carte">
                <div className="colis-haut">
                  <div className="colis-prix">{(c.prix_fcfa || 0).toLocaleString("fr-FR")} FCFA</div>
                  <div className="ch-course-statut" style={{ background: s.bg, color: s.col }}>{s.txt}</div>
                </div>
                <div className="colis-trajet">
                  <div className="colis-point"><span className="colis-pin dep">●</span> {c.ramassage_nom || `${c.ramassage_lat?.toFixed(4)}, ${c.ramassage_lng?.toFixed(4)}`}</div>
                  <div className="colis-point"><span className="colis-pin arr">●</span> {c.livraison_nom || `${c.livraison_lat?.toFixed(4)}, ${c.livraison_lng?.toFixed(4)}`}</div>
                </div>
                <div className="colis-meta">
                  Taille {c.taille} · {c.distance_km} km · {c.mode_livraison === "porte" ? "Porte-à-porte" : "Agence"} · {PAY_NOMS[c.mode_paiement] || c.mode_paiement}
                </div>
                <div className="colis-meta">
                  <b>Destinataire :</b> {c.destinataire_nom}{c.destinataire_tel ? " · " + c.destinataire_tel : ""}
                </div>
                {c.chauffeur_nom && (
                  <div className="colis-meta"><b>Livreur :</b> {c.chauffeur_nom}{c.chauffeur_tel ? " · " + c.chauffeur_tel : ""}</div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

/* ===================== ONGLET VUE D'ENSEMBLE ===================== */
function StatCarte({ titre, valeur, sousTitre, couleur }) {
  return (
    <div className="stat-carte">
      <div className="stat-titre">{titre}</div>
      <div className="stat-valeur" style={{ color: couleur || "#002664" }}>{valeur}</div>
      {sousTitre && <div className="stat-sous">{sousTitre}</div>}
    </div>
  );
}

function OngletApercu() {
  const [chargement, setChargement] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    (async () => {
      setChargement(true);
      // On récupère tout en parallèle
      const [coursesRes, colisRes, chauffeursRes, tarifsRes] = await Promise.all([
        supabase.from("courses").select("prix_fcfa, statut"),
        supabase.from("colis").select("prix_fcfa, statut"),
        supabase.from("chauffeurs").select("statut_verif, statut_compte, en_ligne"),
        supabase.from("tarifs").select("commission_course, commission_colis").eq("id", 1).maybeSingle(),
      ]);

      const courses = coursesRes.data || [];
      const colis = colisRes.data || [];
      const chauffeurs = chauffeursRes.data || [];
      const tarifs = tarifsRes.data || { commission_course: 12, commission_colis: 15 };

      // Courses
      const coursesTerminees = courses.filter((c) => c.statut === "terminee");
      const revenusCourses = coursesTerminees.reduce((s, c) => s + (c.prix_fcfa || 0), 0);
      const commissionCourses = Math.round(revenusCourses * (parseFloat(tarifs.commission_course) || 0) / 100);

      // Répartition courses par statut
      const parStatut = {};
      for (const c of courses) parStatut[c.statut] = (parStatut[c.statut] || 0) + 1;

      // Colis
      const colisLivres = colis.filter((c) => c.statut === "livre");
      const revenusColis = colisLivres.reduce((s, c) => s + (c.prix_fcfa || 0), 0);
      const commissionColis = Math.round(revenusColis * (parseFloat(tarifs.commission_colis) || 0) / 100);

      // Chauffeurs
      const chApprouves = chauffeurs.filter((c) => c.statut_verif === "approuve").length;
      const chEnLigne = chauffeurs.filter((c) => c.en_ligne).length;
      const chBloques = chauffeurs.filter((c) => c.statut_compte === "suspendu" || c.statut_compte === "bloque").length;

      setStats({
        nbCourses: courses.length,
        nbCoursesTerminees: coursesTerminees.length,
        revenusCourses, commissionCourses,
        parStatut,
        nbColis: colis.length,
        nbColisLivres: colisLivres.length,
        revenusColis, commissionColis,
        nbChauffeurs: chauffeurs.length,
        chApprouves, chEnLigne, chBloques,
        commissionTotale: commissionCourses + commissionColis,
        revenusTotal: revenusCourses + revenusColis,
      });
      setChargement(false);
    })();
  }, []);

  if (chargement) return <div className="admin-vide">Calcul des statistiques…</div>;
  if (!stats) return <div className="admin-vide">Aucune donnée.</div>;

  const STATUT_NOM = {
    terminee: "Terminées", acceptee: "En cours", annulee: "Annulées",
    recherche: "En recherche", expiree: "Expirées",
  };

  return (
    <div className="apercu-wrap">
      <div className="apercu-section-titre">💰 Revenus & commission Mira Express</div>
      <div className="stat-grille">
        <StatCarte titre="Revenus totaux générés" valeur={stats.revenusTotal.toLocaleString("fr-FR") + " F"} sousTitre="Courses + colis terminés" couleur="#16a34a" />
        <StatCarte titre="Commission Mira Express" valeur={stats.commissionTotale.toLocaleString("fr-FR") + " F"} sousTitre="Part plateforme encaissée" couleur="#002664" />
      </div>

      <div className="apercu-section-titre">🚗 Courses</div>
      <div className="stat-grille">
        <StatCarte titre="Courses terminées" valeur={stats.nbCoursesTerminees} sousTitre={`sur ${stats.nbCourses} au total`} />
        <StatCarte titre="Revenus courses" valeur={stats.revenusCourses.toLocaleString("fr-FR") + " F"} sousTitre={`commission : ${stats.commissionCourses.toLocaleString("fr-FR")} F`} couleur="#16a34a" />
      </div>
      <div className="apercu-repartition">
        <div className="apercu-repartition-titre">Répartition des courses</div>
        {Object.keys(stats.parStatut).length === 0 ? (
          <div className="ch-courses-vide">Aucune course enregistrée.</div>
        ) : (
          Object.entries(stats.parStatut).map(([statut, nb]) => (
            <div key={statut} className="apercu-repartition-ligne">
              <span>{STATUT_NOM[statut] || statut}</span>
              <b>{nb}</b>
            </div>
          ))
        )}
      </div>

      <div className="apercu-section-titre">📦 Colis</div>
      <div className="stat-grille">
        <StatCarte titre="Colis livrés" valeur={stats.nbColisLivres} sousTitre={`sur ${stats.nbColis} au total`} />
        <StatCarte titre="Revenus colis" valeur={stats.revenusColis.toLocaleString("fr-FR") + " F"} sousTitre={`commission : ${stats.commissionColis.toLocaleString("fr-FR")} F`} couleur="#16a34a" />
      </div>

      <div className="apercu-section-titre">👤 Chauffeurs</div>
      <div className="stat-grille">
        <StatCarte titre="Total chauffeurs" valeur={stats.nbChauffeurs} />
        <StatCarte titre="Approuvés" valeur={stats.chApprouves} couleur="#16a34a" />
        <StatCarte titre="En ligne maintenant" valeur={stats.chEnLigne} couleur="#16a34a" />
        <StatCarte titre="Suspendus / bloqués" valeur={stats.chBloques} couleur="#C60C30" />
      </div>
    </div>
  );
}

/* ===================== APP ADMIN ===================== */
export default function App() {
  const [session, setSession] = useState(null);
  const [authPrete, setAuthPrete] = useState(false);
  const [onglet, setOnglet] = useState("chauffeurs");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthPrete(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => setSession(sess));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function deconnexion() {
    await supabase.auth.signOut();
  }

  if (!authPrete) {
    return <div className="admin-vide">Chargement...</div>;
  }
  if (!session) {
    return <Connexion />;
  }

  const ONGLETS = [
    { id: "chauffeurs", nom: "Chauffeurs", ic: "🚗" },
    { id: "tarifs", nom: "Tarifs", ic: "💰" },
    { id: "colis", nom: "Colis", ic: "📦" },
    { id: "apercu", nom: "Vue d'ensemble", ic: "📊" },
  ];

  return (
    <div className="admin-app">
      <div className="admin-header">
        <h1>Mira Express <span>Admin</span></h1>
        <button className="admin-deco" onClick={deconnexion}>Déconnexion</button>
      </div>

      <div className="admin-onglets">
        {ONGLETS.map((o) => (
          <button key={o.id}
            className={"admin-onglet" + (onglet === o.id ? " actif" : "")}
            onClick={() => setOnglet(o.id)}>
            <span className="admin-onglet-ic">{o.ic}</span>{o.nom}
          </button>
        ))}
      </div>

      {onglet === "chauffeurs" && <OngletChauffeurs />}
      {onglet === "tarifs" && <OngletTarifs />}
      {onglet === "colis" && <OngletColis />}
      {onglet === "apercu" && <OngletApercu />}
    </div>
  );
}
