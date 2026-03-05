"""
Nettoyage du texte extrait des PDFs.
Supprime les artefacts courants qui dégradent la qualité des embeddings.
"""

import re


def clean_text(text: str) -> str:
    """
    Nettoie le texte brut extrait d'une page PDF.

    - Supprime les caractères de contrôle
    - Normalise les espaces et sauts de ligne multiples
    - Retire les lignes trop courtes (artefacts de mise en page)
    """
    if not text:
        return ""

    # Supprimer les caractères de contrôle (sauf \n et \t)
    text = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]", "", text)

    # Remplacer les tabulations par des espaces
    text = text.replace("\t", " ")

    # Normaliser les sauts de ligne multiples en un seul
    text = re.sub(r"\n{3,}", "\n\n", text)

    # Supprimer les espaces en fin de ligne
    text = re.sub(r" +\n", "\n", text)

    # Normaliser les espaces multiples sur une même ligne
    text = re.sub(r" {2,}", " ", text)

    # Retirer les lignes trop courtes (probablement des numéros de page, en-têtes, etc.)
    lines = text.split("\n")
    filtered_lines = [line for line in lines if len(line.strip()) >= 20 or line.strip() == ""]
    text = "\n".join(filtered_lines)

    return text.strip()
