"""
Classification automatique des documents par thème et sous-dossier.

Thèmes disponibles :
- entreprise    : documents liés au travail en entreprise
- ecole         : documents scolaires et de formation
- administratif : documents administratifs personnels
- partage       : documents partagés / rapports finaux
"""

import logging

logger = logging.getLogger(__name__)

THEME_KEYWORDS: dict[str, list[str]] = {
    "entreprise": [
        "entreprise", "réunion", "compte-rendu", "ordre du jour", "pv",
        "projet", "livrable", "cahier des charges", "spécification",
        "planning", "gantt", "sprint", "agile", "client", "fournisseur",
        "équipe", "chef de projet", "mission", "tâche", "suivi de projet",
        "bilan de projet", "revue", "présentation", "documentation technique",
        "architecture technique", "infrastructure", "déploiement",
        "développement logiciel", "prototype", "maquette",
        "processus", "procédure", "guide technique", "ressources",
        "alternant", "tuteur", "maître d'apprentissage",
    ],
    "ecole": [
        "cours", "devoir", "examen", "révision", "matière", "td", "tp",
        "professeur", "enseignant", "classe", "étudiant", "semestre",
        "école", "formation", "programme scolaire", "diplôme", "note",
        "corrigé", "exercice", "sujet d'examen", "partiel", "qcm",
        "rapport d'alternance", "mémoire", "soutenance", "pédagogie",
        "polycopié", "amphi", "amphithéâtre", "année scolaire",
        "travaux pratiques", "travaux dirigés", "compétences scolaires",
    ],
    "administratif": [
        "contrat", "contrat d'alternance", "convention de stage",
        "candidature", "lettre de motivation", "curriculum vitae", "cv",
        "recrutement", "école d'ingénieurs", "admission", "inscription",
        "dossier de candidature", "documents personnels", "pièce d'identité",
        "passeport", "attestation", "certificat", "justificatif",
        "carte vitale", "fiche de paie", "salaire", "opco", "cpf",
        "employeur", "salarié", "apprenti", "centre de formation",
        "rib", "relevé bancaire", "avis d'imposition",
    ],
    "partage": [
        "rapport final", "rapport d'alternance final", "mémoire final",
        "soutenance finale", "document partagé", "collaboration partagée",
        "rapport de fin d'études", "livrable final", "version finale",
    ],
}

SUBFOLDER_KEYWORDS: dict[str, dict[str, list[str]]] = {
    "entreprise": {
        "Projets": [
            "projet", "cahier des charges", "spécification", "sprint", "agile",
            "planning", "gantt", "prototype", "maquette", "développement",
            "chef de projet", "suivi de projet",
        ],
        "Réunions & Comptes-rendus": [
            "réunion", "compte-rendu", "ordre du jour", "pv", "procès-verbal",
            "minutes", "réunion d'équipe",
        ],
        "Livrables & Rapports": [
            "livrable", "rapport", "bilan", "revue", "présentation", "slides",
            "rendu projet",
        ],
        "Ressources techniques": [
            "documentation technique", "architecture", "infrastructure",
            "procédure", "processus", "guide technique", "ressources",
            "référentiel technique", "spécification technique",
        ],
    },
    "ecole": {
        "Cours par matière": [
            "cours", "chapitre", "leçon", "td", "tp", "support de cours",
            "polycopié", "programme",
        ],
        "Devoirs & Rendus": [
            "devoir", "rendu", "exercice", "problème", "travail noté", "dm",
            "travail à rendre",
        ],
        "Examens & Révisions": [
            "examen", "partiel", "qcm", "révision", "corrigé", "sujet d'examen",
            "annales",
        ],
        "Rapport d'alternance": [
            "rapport d'alternance", "rapport de stage", "mémoire", "soutenance",
            "rapport scolaire",
        ],
    },
    "administratif": {
        "Contrat alternance": [
            "contrat", "contrat d'alternance", "convention", "opco", "apprenti",
            "accord", "cerfa",
        ],
        "Candidatures écoles ingénieurs": [
            "candidature", "lettre de motivation", "dossier de candidature",
            "admission", "école d'ingénieurs", "inscription",
        ],
        "Documents personnels": [
            "cv", "curriculum vitae", "pièce d'identité", "passeport",
            "attestation", "certificat", "justificatif", "carte vitale",
            "fiche de paie", "rib", "avis d'imposition",
        ],
    },
    "partage": {
        "Rapports d'alternance finaux": [
            "rapport final", "rapport d'alternance final", "mémoire final",
            "soutenance finale", "rapport de fin d'études", "version finale",
        ],
    },
}

THEME_LABELS = {
    "entreprise": "Entreprise",
    "ecole": "École",
    "administratif": "Administratif",
    "partage": "Partagé",
}


def classify_theme(text: str) -> tuple[str, str | None]:
    """
    Classifie un document dans l'un des 4 thèmes prédéfinis et détecte le sous-dossier.

    Utilise un score de fréquence de mots-clés sur les premiers 2000 caractères.
    Retourne (theme, subfolder).
    """
    sample = text[:2000].lower()
    scores: dict[str, int] = {theme: 0 for theme in THEME_KEYWORDS}

    for theme, keywords in THEME_KEYWORDS.items():
        for kw in keywords:
            scores[theme] += sample.count(kw)

    best_theme = max(scores, key=lambda t: scores[t])
    best_score = scores[best_theme]

    if best_score == 0:
        logger.info("Classification : aucun mot-clé trouvé → 'entreprise' (défaut).")
        return "entreprise", None

    subfolder = _classify_subfolder(best_theme, sample)
    logger.info(
        "Classification : '%s' / '%s' (score=%d). Scores : %s",
        best_theme,
        subfolder,
        best_score,
        scores,
    )
    return best_theme, subfolder


def _classify_subfolder(theme: str, sample: str) -> str | None:
    """Détecte le sous-dossier dans un thème donné."""
    subfolders = SUBFOLDER_KEYWORDS.get(theme, {})
    if not subfolders:
        return None

    scores: dict[str, int] = {sub: 0 for sub in subfolders}
    for sub, keywords in subfolders.items():
        for kw in keywords:
            scores[sub] += sample.count(kw)

    best_sub = max(scores, key=lambda s: scores[s])
    if scores[best_sub] == 0:
        return list(subfolders.keys())[0]  # Premier sous-dossier par défaut

    return best_sub
