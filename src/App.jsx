import { useEffect, useState, useRef } from "react";
import { MapContainer, TileLayer, Marker, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { supabase } from "./supabase";
import "./App.css";

const BUCKET = "pieces-identite";
const NDJAMENA = [12.1348, 15.0557];
const NOM_CATEGORIE = { moto: "Moto", eco: "Éco", confort: "Confort", confortplus: "Confort+" };
const PAY_NOMS = { airtel: "Airtel Money", moov: "Moov Money", cash: "Espèces" };

/* ===================== LOGO MIRA EXPRESS ===================== */
function LogoMiraExpress() {
  return (
    <svg className="me-logo" width="92" height="92" viewBox="0 0 92 92" xmlns="http://www.w3.org/2000/svg">
      <circle cx="46" cy="46" r="44" fill="#002664" />
      <circle cx="46" cy="46" r="44" fill="none" stroke="#FECB00" strokeWidth="3" />
      <path d="M34 70 Q22 46 50 42 Q78 38 58 14" stroke="#FECB00" strokeWidth="5"
        fill="none" strokeLinecap="round" />
      <circle cx="34" cy="70" r="7" fill="#ffffff" />
      <circle cx="58" cy="14" r="7" fill="#C60C30" />
    </svg>
  );
}

/* ===================== ICÔNES DE CARTE ===================== */
function iconePoint(couleur) {
  return L.divIcon({
    className: "",
    html: `<svg width="26" height="34" viewBox="0 0 36 48"><path d="M18 0C8 0 0 8 0 18c0 13 18 30 18 30s18-17 18-30C36 8 28 0 18 0z" fill="${couleur}"/><circle cx="18" cy="18" r="6" fill="#fff"/></svg>`,
    iconSize: [26, 34], iconAnchor: [13, 34],
  });
}
// Voiture : verte = disponible, orange = en mission
function iconeVoiture(couleur) {
  return L.divIcon({
    className: "",
    html: `<svg width="30" height="30" viewBox="0 0 48 48">
      <rect x="14" y="6" width="20" height="36" rx="7" fill="${couleur}" stroke="#fff" stroke-width="2"/>
      <rect x="16" y="13" width="16" height="9" rx="3" fill="#ffffff" opacity="0.75"/>
      <rect x="16" y="27" width="16" height="8" rx="3" fill="#ffffff" opacity="0.75"/>
      <rect x="17" y="23" width="14" height="4" rx="2" fill="#FECB00"/>
    </svg>`,
    iconSize: [30, 30], iconAnchor: [15, 15],
  });
}

// Recentre la carte quand on sélectionne une mission dans la liste.
function CentrerSur({ point, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (point) map.setView(point, zoom || 15, { animate: true });
  }, [point, zoom, map]);
  return null;
}

// Calcule le trajet réel par les routes (OSRM).
async function calculerRoute(a, b) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${a[1]},${a[0]};${b[1]},${b[0]}?overview=full&geometries=geojson`;
    const rep = await fetch(url);
    if (!rep.ok) return null;
    const data = await rep.json();
    if (!data.routes || data.routes.length === 0) return null;
    return data.routes[0].geometry.coordinates.map((c) => [c[1], c[0]]);
  } catch (e) { return null; }
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

/* ===================== ACCÈS REFUSÉ ===================== */
function AccesRefuse({ email, onDeconnexion, desactive }) {
  return (
    <div className="admin-login">
      <div className="admin-login-carte">
        <LogoMiraExpress />
        <h1>Mira <span>Express</span></h1>
        <p>Administration</p>
        <div className="acces-refuse-ic">{desactive ? "⛔" : "🔒"}</div>
        <div className="acces-refuse-titre">
          {desactive ? "Compte désactivé" : "Accès réservé"}
        </div>
        <div className="acces-refuse-txt">
          {desactive
            ? "Votre compte administrateur a été désactivé. Contactez la direction de Mira Express."
            : "Ce compte n'est pas autorisé à accéder au tableau de bord d'administration."}
        </div>
        <div className="acces-refuse-mail">{email}</div>
        <button className="admin-btn" onClick={onDeconnexion} style={{ background: "#6b7280" }}>
          Se déconnecter
        </button>
      </div>
    </div>
  );
}

/* ===================== ONGLET SUIVI LIVE ===================== */
function OngletSuiviLive() {
  const [chauffeurs, setChauffeurs] = useState([]);
  const [courses, setCourses] = useState([]);
  const [colis, setColis] = useState([]);
  const [filtre, setFiltre] = useState("tout"); // tout | chauffeurs | courses | colis
  const [selection, setSelection] = useState(null); // { type, id }
  const [routeSel, setRouteSel] = useState(null);
  const [centre, setCentre] = useState(null);
  const [chargement, setChargement] = useState(true);
  const [derniereMaj, setDerniereMaj] = useState(null);

  async function charger() {
    const [chRes, coRes, clRes] = await Promise.all([
      supabase.from("chauffeurs").select("*").eq("en_ligne", true),
      supabase.from("courses").select("*").eq("statut", "acceptee"),
      supabase.from("colis").select("*").eq("statut", "acceptee"),
    ]);
    setChauffeurs(chRes.data || []);
    setCourses(coRes.data || []);
    setColis(clRes.data || []);
    setChargement(false);
    setDerniereMaj(new Date());
  }

  // Rafraîchissement automatique toutes les 3 secondes
  useEffect(() => {
    charger();
    const minuterie = setInterval(charger, 3000);
    return () => clearInterval(minuterie);
  }, []);

  // Quand on sélectionne une mission, on calcule son trajet et on centre la carte.
  useEffect(() => {
    if (!selection) { setRouteSel(null); return; }
    let annule = false;

    if (selection.type === "course") {
      const c = courses.find((x) => x.id === selection.id);
      if (!c) { setRouteSel(null); return; }
      const posCh = c.chauffeur_lat ? [c.chauffeur_lat, c.chauffeur_lng] : null;
      const dep = [c.depart_lat, c.depart_lng];
      const dst = [c.dest_lat, c.dest_lng];
      setCentre(posCh || dep);
      // Avant démarrage : chauffeur -> client. Après : départ -> destination.
      const a = c.demarree ? dep : (posCh || dep);
      const b = c.demarree ? dst : dep;
      calculerRoute(a, b).then((pts) => { if (!annule) setRouteSel(pts); });
    } else if (selection.type === "colis") {
      const c = colis.find((x) => x.id === selection.id);
      if (!c) { setRouteSel(null); return; }
      const posCh = c.chauffeur_lat ? [c.chauffeur_lat, c.chauffeur_lng] : null;
      const ram = [c.ramassage_lat, c.ramassage_lng];
      const liv = [c.livraison_lat, c.livraison_lng];
      setCentre(posCh || ram);
      const a = c.recupere ? ram : (posCh || ram);
      const b = c.recupere ? liv : ram;
      calculerRoute(a, b).then((pts) => { if (!annule) setRouteSel(pts); });
    } else if (selection.type === "chauffeur") {
      const ch = chauffeurs.find((x) => x.user_id === selection.id);
      if (ch && ch.position_lat) setCentre([ch.position_lat, ch.position_lng]);
      setRouteSel(null);
    }
    return () => { annule = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, courses, colis, chauffeurs]);

  const voirChauffeurs = filtre === "tout" || filtre === "chauffeurs";
  const voirCourses = filtre === "tout" || filtre === "courses";
  const voirColis = filtre === "tout" || filtre === "colis";

  // Chauffeurs disponibles (pas en mission) affichés seuls
  const dispo = chauffeurs.filter((c) => !c.en_course && c.position_lat != null);
  const occupes = chauffeurs.filter((c) => c.en_course).length;

  const FILTRES = [
    { id: "tout", nom: "Tout", ic: "🌍" },
    { id: "chauffeurs", nom: "Chauffeurs", ic: "🚗" },
    { id: "courses", nom: "Courses", ic: "🧍" },
    { id: "colis", nom: "Colis", ic: "📦" },
  ];

  return (
    <div className="live-wrap">
      {/* Bandeau de statistiques rapides */}
      <div className="live-stats">
        <div className="live-stat">
          <div className="live-stat-val" style={{ color: "#16a34a" }}>{chauffeurs.length}</div>
          <div className="live-stat-lib">En ligne</div>
        </div>
        <div className="live-stat">
          <div className="live-stat-val" style={{ color: "#f97316" }}>{occupes}</div>
          <div className="live-stat-lib">En mission</div>
        </div>
        <div className="live-stat">
          <div className="live-stat-val" style={{ color: "#002664" }}>{courses.length}</div>
          <div className="live-stat-lib">Courses</div>
        </div>
        <div className="live-stat">
          <div className="live-stat-val" style={{ color: "#a16207" }}>{colis.length}</div>
          <div className="live-stat-lib">Colis</div>
        </div>
      </div>

      {/* Filtres d'affichage */}
      <div className="live-filtres">
        {FILTRES.map((f) => (
          <button key={f.id}
            className={"live-filtre" + (filtre === f.id ? " actif" : "")}
            onClick={() => { setFiltre(f.id); setSelection(null); }}>
            <span>{f.ic}</span> {f.nom}
          </button>
        ))}
      </div>

      {/* Carte */}
      <div className="live-carte">
        <MapContainer center={NDJAMENA} zoom={12} style={{ height: "100%", width: "100%" }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />
          <CentrerSur point={centre} zoom={15} />

          {/* Chauffeurs disponibles (vert) */}
          {voirChauffeurs && dispo.map((c) => (
            <Marker key={c.user_id} position={[c.position_lat, c.position_lng]}
              icon={iconeVoiture("#16a34a")}
              eventHandlers={{ click: () => setSelection({ type: "chauffeur", id: c.user_id }) }} />
          ))}

          {/* Courses en cours */}
          {voirCourses && courses.map((c) => {
            const posCh = c.chauffeur_lat ? [c.chauffeur_lat, c.chauffeur_lng] : null;
            return (
              <div key={c.id}>
                {posCh && (
                  <Marker position={posCh} icon={iconeVoiture("#f97316")}
                    eventHandlers={{ click: () => setSelection({ type: "course", id: c.id }) }} />
                )}
                <Marker position={[c.depart_lat, c.depart_lng]} icon={iconePoint("#002664")}
                  eventHandlers={{ click: () => setSelection({ type: "course", id: c.id }) }} />
                <Marker position={[c.dest_lat, c.dest_lng]} icon={iconePoint("#C60C30")}
                  eventHandlers={{ click: () => setSelection({ type: "course", id: c.id }) }} />
              </div>
            );
          })}

          {/* Colis en cours */}
          {voirColis && colis.map((c) => {
            const posCh = c.chauffeur_lat ? [c.chauffeur_lat, c.chauffeur_lng] : null;
            return (
              <div key={c.id}>
                {posCh && (
                  <Marker position={posCh} icon={iconeVoiture("#FECB00")}
                    eventHandlers={{ click: () => setSelection({ type: "colis", id: c.id }) }} />
                )}
                <Marker position={[c.ramassage_lat, c.ramassage_lng]} icon={iconePoint("#a16207")}
                  eventHandlers={{ click: () => setSelection({ type: "colis", id: c.id }) }} />
                <Marker position={[c.livraison_lat, c.livraison_lng]} icon={iconePoint("#C60C30")}
                  eventHandlers={{ click: () => setSelection({ type: "colis", id: c.id }) }} />
              </div>
            );
          })}

          {/* Trajet de la mission sélectionnée */}
          {routeSel && (
            <>
              <Polyline positions={routeSel} pathOptions={{ color: "#fff", weight: 9, opacity: 0.9 }} />
              <Polyline positions={routeSel} pathOptions={{ color: "#16a34a", weight: 5 }} />
            </>
          )}
        </MapContainer>
      </div>

      {/* Légende */}
      <div className="live-legende">
        <span><i style={{ background: "#16a34a" }}></i> Disponible</span>
        <span><i style={{ background: "#f97316" }}></i> En course</span>
        <span><i style={{ background: "#FECB00" }}></i> Livraison colis</span>
        <span><i style={{ background: "#002664" }}></i> Départ</span>
        <span><i style={{ background: "#C60C30" }}></i> Arrivée</span>
      </div>

      {/* Liste des missions en cours */}
      <div className="live-liste">
        {chargement ? (
          <div className="admin-vide">Chargement du suivi…</div>
        ) : (
          <>
            {voirCourses && courses.length > 0 && (
              <>
                <div className="live-liste-titre">🧍 Courses en cours ({courses.length})</div>
                {courses.map((c) => {
                  const sel = selection && selection.type === "course" && selection.id === c.id;
                  return (
                    <div key={c.id}
                      className={"live-item" + (sel ? " sel" : "")}
                      onClick={() => setSelection({ type: "course", id: c.id })}>
                      <div className="live-item-haut">
                        <div className="live-item-prix">{(c.prix_fcfa || 0).toLocaleString("fr-FR")} FCFA</div>
                        <div className={"live-item-etat " + (c.demarree ? "route" : "attente")}>
                          {c.demarree ? "🚗 En route" : "⏳ Va chercher le client"}
                        </div>
                      </div>
                      <div className="live-item-meta">
                        <b>{c.chauffeur_nom || "—"}</b>
                        {c.chauffeur_plaque ? " · " + c.chauffeur_plaque : ""}
                        {c.chauffeur_tel ? " · " + c.chauffeur_tel : ""}
                      </div>
                      <div className="live-item-meta">
                        {NOM_CATEGORIE[c.classe] || c.classe} · {c.distance_km} km · {PAY_NOMS[c.mode_paiement] || c.mode_paiement}
                      </div>
                      {c.chauffeur_lat == null && (
                        <div className="live-item-alerte">⚠️ Position GPS non reçue</div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

            {voirColis && colis.length > 0 && (
              <>
                <div className="live-liste-titre">📦 Colis en livraison ({colis.length})</div>
                {colis.map((c) => {
                  const sel = selection && selection.type === "colis" && selection.id === c.id;
                  return (
                    <div key={c.id}
                      className={"live-item" + (sel ? " sel" : "")}
                      style={{ borderLeftColor: "#FECB00" }}
                      onClick={() => setSelection({ type: "colis", id: c.id })}>
                      <div className="live-item-haut">
                        <div className="live-item-prix">{(c.prix_fcfa || 0).toLocaleString("fr-FR")} FCFA</div>
                        <div className={"live-item-etat " + (c.recupere ? "route" : "attente")}>
                          {c.recupere ? "📦 En livraison" : "⏳ Va chercher le colis"}
                        </div>
                      </div>
                      <div className="live-item-meta">
                        <b>{c.chauffeur_nom || "—"}</b>
                        {c.chauffeur_tel ? " · " + c.chauffeur_tel : ""}
                      </div>
                      <div className="live-item-meta">
                        Taille {c.taille} · {c.distance_km} km · Destinataire : {c.destinataire_nom}
                      </div>
                    </div>
                  );
                })}
              </>
            )}

            {voirChauffeurs && (
              <>
                <div className="live-liste-titre">🚗 Chauffeurs en ligne ({chauffeurs.length})</div>
                {chauffeurs.length === 0 ? (
                  <div className="admin-vide">Aucun chauffeur en ligne actuellement.</div>
                ) : (
                  chauffeurs.map((c) => {
                    const sel = selection && selection.type === "chauffeur" && selection.id === c.user_id;
                    return (
                      <div key={c.user_id}
                        className={"live-item" + (sel ? " sel" : "")}
                        style={{ borderLeftColor: c.en_course ? "#f97316" : "#16a34a" }}
                        onClick={() => setSelection({ type: "chauffeur", id: c.user_id })}>
                        <div className="live-item-haut">
                          <div className="live-item-nom">{c.nom}</div>
                          <div className={"live-item-etat " + (c.en_course ? "attente" : "dispo")}>
                            {c.en_course ? "🟠 En mission" : "🟢 Disponible"}
                          </div>
                        </div>
                        <div className="live-item-meta">
                          {c.vehicule} · {c.plaque} · {NOM_CATEGORIE[c.categorie] || c.categorie}
                        </div>
                        {c.position_lat == null && (
                          <div className="live-item-alerte">⚠️ Position GPS non reçue</div>
                        )}
                      </div>
                    );
                  })
                )}
              </>
            )}

            {courses.length === 0 && colis.length === 0 && chauffeurs.length === 0 && (
              <div className="admin-vide">Aucune activité en cours pour le moment.</div>
            )}
          </>
        )}
      </div>

      {derniereMaj && (
        <div className="live-maj">
          Actualisé à {derniereMaj.toLocaleTimeString("fr-FR")} · rafraîchissement automatique
        </div>
      )}
    </div>
  );
}

/* ===================== COURSES D'UN CHAUFFEUR ===================== */
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

/* ===================== ONGLET TARIFS (DG uniquement) ===================== */
function ChampTarif({ label, suffixe, valeur, onChange }) {
  return (
    <div className="tf-champ">
      <label className="tf-label">{label}</label>
      <div className="tf-input-zone">
        <input type="number" className="tf-input" value={valeur}
          onChange={(e) => onChange(e.target.value)} />
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
      "confortplus_km", "confortplus_min", "supplement_pointe", "supplement_arret",
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
  if (!tarifs) return <div className="admin-vide">{erreur || "Aucun tarif trouvé."}</div>;

  return (
    <div className="tf-wrap">
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
          <div className="tf-note" style={{ marginTop: "12px" }}>
          Supplément facturé pour chaque point d'arrêt intermédiaire ajouté par le client (3 maximum).
        </div>
        <ChampTarif label="Supplément par arrêt" suffixe="F" valeur={tarifs.supplement_arret} onChange={(v) => maj("supplement_arret", v)} />
      </div>

      <div className="tf-section">
        <div className="tf-section-titre">📦 Tarifs des colis</div>
        <div className="tf-grille">
          <ChampTarif label="Base petit colis" suffixe="F" valeur={tarifs.colis_petit} onChange={(v) => maj("colis_petit", v)} />
          <ChampTarif label="Base colis moyen" suffixe="F" valeur={tarifs.colis_moyen} onChange={(v) => maj("colis_moyen", v)} />
          <ChampTarif label="Base grand colis" suffixe="F" valeur={tarifs.colis_grand} onChange={(v) => maj("colis_grand", v)} />
          <ChampTarif label="Prix par km" suffixe="F" valeur={tarifs.colis_km} onChange={(v) => maj("colis_km", v)} />
        </div>
      </div>

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

/* ===================== ONGLET VUE D'ENSEMBLE (DG uniquement) ===================== */
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

      const coursesTerminees = courses.filter((c) => c.statut === "terminee");
      const revenusCourses = coursesTerminees.reduce((s, c) => s + (c.prix_fcfa || 0), 0);
      const commissionCourses = Math.round(revenusCourses * (parseFloat(tarifs.commission_course) || 0) / 100);

      const parStatut = {};
      for (const c of courses) parStatut[c.statut] = (parStatut[c.statut] || 0) + 1;

      const colisLivres = colis.filter((c) => c.statut === "livre");
      const revenusColis = colisLivres.reduce((s, c) => s + (c.prix_fcfa || 0), 0);
      const commissionColis = Math.round(revenusColis * (parseFloat(tarifs.commission_colis) || 0) / 100);

      const chApprouves = chauffeurs.filter((c) => c.statut_verif === "approuve").length;
      const chEnLigne = chauffeurs.filter((c) => c.en_ligne).length;
      const chBloques = chauffeurs.filter((c) => c.statut_compte === "suspendu" || c.statut_compte === "bloque").length;

      setStats({
        nbCourses: courses.length,
        nbCoursesTerminees: coursesTerminees.length,
        revenusCourses, commissionCourses, parStatut,
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

/* ===================== ONGLET ÉQUIPE (DG uniquement) ===================== */
function OngletEquipe({ monUserId }) {
  const [admins, setAdmins] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [message, setMessage] = useState(null);

  async function chargerAdmins() {
    setChargement(true);
    const { data } = await supabase.from("admins").select("*").order("cree_le", { ascending: true });
    setAdmins(data || []);
    setChargement(false);
  }

  useEffect(() => { chargerAdmins(); }, []);

  async function changerRole(userId, nouveauRole) {
    await supabase.from("admins").update({ role: nouveauRole }).eq("user_id", userId);
    setMessage("✓ Rôle mis à jour.");
    chargerAdmins();
    setTimeout(() => setMessage(null), 3000);
  }

  async function changerActif(userId, actif) {
    await supabase.from("admins").update({ actif }).eq("user_id", userId);
    setMessage(actif ? "✓ Compte réactivé." : "✓ Compte désactivé.");
    chargerAdmins();
    setTimeout(() => setMessage(null), 3000);
  }

  if (chargement) return <div className="admin-vide">Chargement de l'équipe…</div>;

  return (
    <div className="equipe-wrap">
      <div className="equipe-info">
        <b>Comment ajouter un membre ?</b><br />
        La personne crée d'abord un compte sur l'application (email + mot de passe).
        Ensuite, ajoutez son identifiant dans la table <code>admins</code> depuis Supabase,
        avec le rôle « employe » ou « dg ».
      </div>

      {message && <div className="tf-succes">{message}</div>}

      {admins.length === 0 ? (
        <div className="admin-vide">Aucun administrateur enregistré.</div>
      ) : (
        admins.map((a) => {
          const estMoi = a.user_id === monUserId;
          const estDG = a.role === "dg";
          return (
            <div key={a.user_id} className="equipe-carte">
              <div className="equipe-haut">
                <div>
                  <div className="equipe-nom">
                    {a.nom || "(sans nom)"}
                    {estMoi && <span className="equipe-moi">vous</span>}
                  </div>
                  <div className="equipe-mail">{a.email}</div>
                </div>
                <div className={"equipe-role " + (estDG ? "dg" : "employe")}>
                  {estDG ? "👔 Directeur" : "👤 Employé"}
                </div>
              </div>

              {!a.actif && <div className="equipe-desactive">⛔ Compte désactivé</div>}

              {!estMoi && (
                <div className="equipe-actions">
                  {estDG ? (
                    <button className="equipe-btn" onClick={() => changerRole(a.user_id, "employe")}
                      style={{ background: "#f97316", color: "#fff" }}>
                      Passer en Employé
                    </button>
                  ) : (
                    <button className="equipe-btn" onClick={() => changerRole(a.user_id, "dg")}
                      style={{ background: "#002664", color: "#fff" }}>
                      Passer en Directeur
                    </button>
                  )}
                  {a.actif ? (
                    <button className="equipe-btn" onClick={() => changerActif(a.user_id, false)}
                      style={{ background: "#fff", color: "#C60C30", border: "1.5px solid #C60C30" }}>
                      Désactiver
                    </button>
                  ) : (
                    <button className="equipe-btn" onClick={() => changerActif(a.user_id, true)}
                      style={{ background: "#16a34a", color: "#fff" }}>
                      Réactiver
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

/* ===================== ONGLET NOUVEAU CHAUFFEUR (agence) ===================== */
/* Permet à un employé d'enregistrer sur place un chauffeur venu à l'agence.
   Le dossier est déposé dans chauffeurs_prepares. Le chauffeur créera ensuite
   son compte lui-même sur l'application, avec son propre mot de passe. */
function OngletNouveauChauffeur({ monEmail }) {
  const [nom, setNom] = useState("");
  const [telephone, setTelephone] = useState("");
  const [plaque, setPlaque] = useState("");
  const [vehicule, setVehicule] = useState("");
  const [couleur, setCouleur] = useState("");
  const [categorie, setCategorie] = useState("eco");
  const [pieceChemin, setPieceChemin] = useState(null);
  const [selfieChemin, setSelfieChemin] = useState(null);
  const [apercuPiece, setApercuPiece] = useState(null);
  const [apercuSelfie, setApercuSelfie] = useState(null);
  const [uploadPiece, setUploadPiece] = useState(false);
  const [uploadSelfie, setUploadSelfie] = useState(false);
  const [enreg, setEnreg] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [succes, setSucces] = useState(null);
  const [prepares, setPrepares] = useState([]);
  const pieceRef = useRef(null);
  const selfieRef = useRef(null);

  const CATS = [
    { id: "moto", nom: "Moto", ic: "🛵" },
    { id: "eco", nom: "Éco", ic: "🚗" },
    { id: "confort", nom: "Confort", ic: "🚙" },
    { id: "confortplus", nom: "Confort+", ic: "🚘" },
  ];

  async function chargerPrepares() {
    const { data } = await supabase.from("chauffeurs_prepares")
      .select("*").order("cree_le", { ascending: false }).limit(20);
    setPrepares(data || []);
  }
  useEffect(() => { chargerPrepares(); }, []);

  // Téléverse la photo dans un dossier temporaire basé sur le téléphone.
  async function televerser(e, type) {
    const fichier = e.target.files?.[0];
    if (!fichier) return;
    setErreur(null);
    if (!telephone.trim()) {
      setErreur("Renseignez d'abord le téléphone du chauffeur (il sert de repère pour les photos).");
      return;
    }
    if (fichier.size > 5 * 1024 * 1024) { setErreur("Le fichier est trop lourd (max 5 Mo)."); return; }
    const ext = fichier.name.split(".").pop() || "jpg";
    const tel = telephone.trim().replace(/[^0-9]/g, "");
    const chemin = `agence-${tel}/${type}.${ext}`;

    if (type === "piece") setUploadPiece(true); else setUploadSelfie(true);
    const { error } = await supabase.storage.from(BUCKET).upload(chemin, fichier, { upsert: true });
    if (type === "piece") setUploadPiece(false); else setUploadSelfie(false);

    if (error) { setErreur("Échec du téléversement : " + error.message); return; }

    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(chemin, 600);
    if (type === "piece") {
      setPieceChemin(chemin);
      if (data) setApercuPiece(data.signedUrl);
    } else {
      setSelfieChemin(chemin);
      if (data) setApercuSelfie(data.signedUrl);
    }
  }

  function reinitialiser() {
    setNom(""); setTelephone(""); setPlaque(""); setVehicule(""); setCouleur("");
    setCategorie("eco"); setPieceChemin(null); setSelfieChemin(null);
    setApercuPiece(null); setApercuSelfie(null); setErreur(null);
  }

  async function enregistrer() {
    setErreur(null); setSucces(null);
    if (!nom.trim() || !telephone.trim() || !plaque.trim() || !vehicule.trim() || !couleur.trim()) {
      setErreur("Tous les champs sont obligatoires."); return;
    }
    if (!pieceChemin) { setErreur("Photographiez la pièce d'identité du chauffeur."); return; }
    if (!selfieChemin) { setErreur("Prenez la photo du chauffeur."); return; }

    setEnreg(true);
    const { error } = await supabase.from("chauffeurs_prepares").insert({
      nom: nom.trim(),
      telephone: telephone.trim(),
      plaque: plaque.trim(),
      vehicule: vehicule.trim(),
      couleur: couleur.trim(),
      categorie,
      piece_identite_url: pieceChemin,
      selfie_url: selfieChemin,
      prepare_par: monEmail,
    });
    setEnreg(false);

    if (error) {
      if (error.message.includes("duplicate") || error.message.includes("unique")) {
        setErreur("Un dossier existe déjà pour ce numéro de téléphone.");
      } else {
        setErreur("Échec de l'enregistrement : " + error.message);
      }
      return;
    }

    setSucces(`✓ Dossier créé pour ${nom.trim()}. Demandez-lui de créer son compte sur l'application avec le numéro ${telephone.trim()}. Il sera actif immédiatement.`);
    reinitialiser();
    chargerPrepares();
  }

  return (
    <div className="nch-wrap">
      <div className="nch-info">
        <b>Enregistrer un chauffeur venu à l'agence</b><br />
        Saisissez ses informations et photographiez ses pièces. Le dossier sera
        <b> pré-approuvé</b>. Il devra ensuite créer son compte sur l'application
        avec <b>le même numéro de téléphone</b> : son dossier sera automatiquement
        rattaché et il pourra travailler immédiatement.
      </div>

      <div className="nch-form">
        <label className="profil-label">Nom complet</label>
        <input className="admin-input" value={nom} onChange={(e) => setNom(e.target.value)}
          placeholder="Ex : Mahamat Ali" />

        <label className="profil-label">Téléphone (clé de rattachement)</label>
        <input className="admin-input" value={telephone} onChange={(e) => setTelephone(e.target.value)}
          placeholder="Ex : +235 66 12 34 56" />

        <label className="profil-label">Plaque d'immatriculation</label>
        <input className="admin-input" value={plaque} onChange={(e) => setPlaque(e.target.value)}
          placeholder="Ex : TD 4271" />

        <label className="profil-label">Véhicule (marque et modèle)</label>
        <input className="admin-input" value={vehicule} onChange={(e) => setVehicule(e.target.value)}
          placeholder="Ex : Toyota Corolla" />

        <label className="profil-label">Couleur du véhicule</label>
        <input className="admin-input" value={couleur} onChange={(e) => setCouleur(e.target.value)}
          placeholder="Ex : Blanche" />

        <label className="profil-label">Catégorie</label>
        <div className="nch-cats">
          {CATS.map((c) => (
            <div key={c.id}
              className={"nch-cat" + (categorie === c.id ? " sel" : "")}
              onClick={() => setCategorie(c.id)}>
              <div className="nch-cat-ic">{c.ic}</div>
              <div className="nch-cat-nom">{c.nom}</div>
            </div>
          ))}
        </div>

        <label className="profil-label">Pièce d'identité</label>
        <div className="nch-photo">
          {apercuPiece
            ? <img src={apercuPiece} alt="Pièce" className="nch-apercu" />
            : <div className="nch-vide">Aucune pièce photographiée</div>}
          <input ref={pieceRef} type="file" accept="image/*" capture="environment"
            onChange={(e) => televerser(e, "piece")} style={{ display: "none" }} />
          <button className="nch-photo-btn" disabled={uploadPiece}
            onClick={() => pieceRef.current && pieceRef.current.click()}>
            {uploadPiece ? "Téléversement…" : apercuPiece ? "Changer la pièce" : "📷 Photographier la pièce"}
          </button>
        </div>

        <label className="profil-label">Photo du chauffeur</label>
        <div className="nch-photo">
          {apercuSelfie
            ? <img src={apercuSelfie} alt="Photo" className="nch-apercu" />
            : <div className="nch-vide">Aucune photo prise</div>}
          <input ref={selfieRef} type="file" accept="image/*"
            onChange={(e) => televerser(e, "selfie")} style={{ display: "none" }} />
          <button className="nch-photo-btn" disabled={uploadSelfie}
            onClick={() => selfieRef.current && selfieRef.current.click()}>
            {uploadSelfie ? "Téléversement…" : apercuSelfie ? "Reprendre la photo" : "📷 Photographier le chauffeur"}
          </button>
        </div>

        {erreur && <div className="tf-erreur">{erreur}</div>}
        {succes && <div className="tf-succes">{succes}</div>}

        <button className="tf-enregistrer" onClick={enregistrer} disabled={enreg}>
          {enreg ? "Enregistrement…" : "Enregistrer le dossier"}
        </button>
      </div>

      {/* Liste des dossiers préparés */}
      <div className="nch-liste-titre">Dossiers préparés ({prepares.length})</div>
      {prepares.length === 0 ? (
        <div className="admin-vide">Aucun dossier préparé pour le moment.</div>
      ) : (
        prepares.map((p) => (
          <div key={p.id} className="nch-item">
            <div className="nch-item-haut">
              <div>
                <div className="nch-item-nom">{p.nom}</div>
                <div className="nch-item-meta">{p.vehicule} · {p.plaque} · {p.telephone}</div>
              </div>
              <div className={"nch-item-etat " + (p.utilise ? "actif" : "attente")}>
                {p.utilise ? "✓ Compte créé" : "⏳ En attente"}
              </div>
            </div>
            {p.prepare_par && (
              <div className="nch-item-par">Préparé par {p.prepare_par}</div>
            )}
          </div>
        ))
      )}
    </div>
  );
}

/* ===================== APP ADMIN ===================== */
export default function App() {
  const [session, setSession] = useState(null);
  const [authPrete, setAuthPrete] = useState(false);
  const [monAdmin, setMonAdmin] = useState(null);
  const [adminCharge, setAdminCharge] = useState(false);
  const [onglet, setOnglet] = useState("live");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthPrete(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
      setSession(sess);
      setMonAdmin(null);
      setAdminCharge(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setAdminCharge(false); setMonAdmin(null); return; }
    (async () => {
      const { data } = await supabase
        .from("admins").select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      setMonAdmin(data || null);
      setAdminCharge(true);
    })();
  }, [session]);

  async function deconnexion() {
    await supabase.auth.signOut();
  }

  if (!authPrete) return <div className="admin-vide">Chargement...</div>;
  if (!session) return <Connexion />;
  if (!adminCharge) return <div className="admin-vide">Vérification des accès…</div>;
  if (!monAdmin) return <AccesRefuse email={session.user.email} onDeconnexion={deconnexion} desactive={false} />;
  if (monAdmin.actif === false) return <AccesRefuse email={session.user.email} onDeconnexion={deconnexion} desactive={true} />;

  const estDG = monAdmin.role === "dg";

  // Suivi live et Chauffeurs/Colis : accessibles à tous.
  // Tarifs, Vue d'ensemble et Équipe : DG uniquement.
  const ONGLETS = [
    { id: "live", nom: "Suivi live", ic: "📡", dgSeul: false },
    { id: "chauffeurs", nom: "Chauffeurs", ic: "🚗", dgSeul: false },
    { id: "nouveau", nom: "Nouveau chauffeur", ic: "➕", dgSeul: false },
    { id: "colis", nom: "Colis", ic: "📦", dgSeul: false },
    { id: "tarifs", nom: "Tarifs", ic: "💰", dgSeul: true },
    { id: "apercu", nom: "Vue d'ensemble", ic: "📊", dgSeul: true },
    { id: "equipe", nom: "Équipe", ic: "👥", dgSeul: true },
  ].filter((o) => estDG || !o.dgSeul);

  const ongletAutorise = ONGLETS.some((o) => o.id === onglet) ? onglet : "live";

  return (
    <div className="admin-app">
      <div className="admin-header">
        <h1>Mira Express <span>Admin</span></h1>
        <div className="admin-header-droite">
          <div className={"admin-role-badge " + (estDG ? "dg" : "employe")}>
            {estDG ? "👔 Directeur" : "👤 Employé"}
          </div>
          <button className="admin-deco" onClick={deconnexion}>Déconnexion</button>
        </div>
      </div>

      <div className="admin-onglets">
        {ONGLETS.map((o) => (
          <button key={o.id}
            className={"admin-onglet" + (ongletAutorise === o.id ? " actif" : "")}
            onClick={() => setOnglet(o.id)}>
            <span className="admin-onglet-ic">{o.ic}</span>{o.nom}
          </button>
        ))}
      </div>

      {ongletAutorise === "live" && <OngletSuiviLive />}
      {ongletAutorise === "nouveau" && <OngletNouveauChauffeur monEmail={monAdmin.email} />}
      {ongletAutorise === "chauffeurs" && <OngletChauffeurs />}
      {ongletAutorise === "colis" && <OngletColis />}
      {ongletAutorise === "tarifs" && estDG && <OngletTarifs />}
      {ongletAutorise === "apercu" && estDG && <OngletApercu />}
      {ongletAutorise === "equipe" && estDG && <OngletEquipe monUserId={session.user.id} />}
    </div>
  );
}
