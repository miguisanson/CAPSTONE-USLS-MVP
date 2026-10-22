"""Demo subject titles and suggested terms for the programs whose monitoring sheet has only codes (I-061).

The registrar's monitoring sheets name each subject column with a code (MAED-STAT, MAED-MAJ1,
MAED-COG3 ...), so the importer had no title to store and the screens showed "MAED-FED MAED-FED".
MBA and DPSY come with their real curriculum (AUTHORITATIVE_CURRICULA in app.py). For the other
programs these are plain DEMONSTRATION titles, one set per field of study, chosen so a subject reads
like a graduate subject. They are not the real USLS curricula; replace them when the registrar sends
the real subject lists. Plain data only; app.py does the seeding.
"""

# program code -> field of study
PROGRAM_DOMAIN = {
    "MSCS": "computing",
    "MIT": "computing",
    "DBA": "business",
    "MAED": "education",
    "EDD": "education",
    "MSN": "nursing",
    "MAN": "nursing",
    "MAPSY": "psychology",
    "MSGC": "guidance",
    "MASS": "social",
}

# field -> 3 basic, 5 major and 10 cognate titles, in the order of the sheet columns
# (STAT, MOR, FED / MAJ1..MAJ5 / COG1..COG10).
DOMAIN_TITLES = {
    "computing": {
        "basic": ["Statistics for Computing Research", "Methods of Research in Computing", "Foundations of Computing Science"],
        "major": ["Advanced Algorithms and Data Structures", "Software Engineering Practice", "Database Systems",
                  "Computer Networks and Security", "Systems Analysis and Design"],
        "cognate": ["Machine Learning", "Data Mining and Analytics", "Cloud Computing", "Human-Computer Interaction",
                    "Information Security Management", "Mobile Application Development", "Artificial Intelligence",
                    "IT Project Management", "Web Systems Engineering", "Emerging Technologies Seminar"],
    },
    "business": {
        "basic": ["Business Statistics", "Business Research Methods", "Foundations of Management"],
        "major": ["Strategic Management", "Organizational Behavior", "Financial Management",
                  "Marketing Management", "Operations Management"],
        "cognate": ["Entrepreneurship", "Business Ethics and Governance", "Human Resource Management",
                    "Corporate Finance", "Supply Chain Management", "Consumer Behavior", "Leadership Theory and Practice",
                    "Managerial Economics", "International Business", "Management Decision Models"],
    },
    "education": {
        "basic": ["Statistics in Education", "Methods of Educational Research", "Foundations of Education"],
        "major": ["Curriculum Development and Evaluation", "Educational Leadership and Management",
                  "Assessment of Learning", "Educational Technology and Instruction", "Philosophy of Education"],
        "cognate": ["Teaching Strategies in Higher Education", "Learning Analytics", "Inclusive Education",
                    "Action Research in the Classroom", "School Administration and Supervision", "Educational Policy and Planning",
                    "Guidance and Student Development", "Instructional Design", "Language and Literacy Education",
                    "Seminar on Contemporary Issues in Education"],
    },
    "nursing": {
        "basic": ["Biostatistics", "Nursing Research Methods", "Foundations of Advanced Nursing Practice"],
        "major": ["Advanced Pathophysiology", "Health Assessment and Diagnostics", "Nursing Theory and Practice",
                  "Community and Public Health Nursing", "Nursing Leadership and Management"],
        "cognate": ["Health Informatics", "Gerontological Nursing", "Maternal and Child Health", "Mental Health Nursing",
                    "Epidemiology", "Nursing Education", "Clinical Pharmacology", "Evidence-Based Practice",
                    "Health Policy and Ethics", "Critical Care Nursing"],
    },
    "psychology": {
        "basic": ["Advanced Statistics", "Research Methods in Psychology", "Foundations of Psychology"],
        "major": ["Theories of Personality", "Psychological Assessment", "Counseling and Psychotherapy",
                  "Abnormal Psychology", "Developmental Psychology"],
        "cognate": ["Industrial and Organizational Psychology", "Health Psychology", "Social Psychology",
                    "Cognitive Psychology", "Positive Psychology", "Child and Adolescent Psychology",
                    "Addiction Psychology", "Psychology of Gender", "Community Psychology", "Ethics in Psychological Practice"],
    },
    "guidance": {
        "basic": ["Statistics in Guidance and Counseling", "Methods of Research in Counseling", "Foundations of Guidance and Counseling"],
        "major": ["Theories of Counseling", "Group Counseling and Process", "Career Development and Counseling",
                  "Assessment in Guidance", "Guidance Program Management"],
        "cognate": ["Family Counseling", "Crisis Intervention", "Counseling Children and Adolescents",
                    "Multicultural Counseling", "School Counseling", "Substance Abuse Counseling",
                    "Ethics in Counseling", "Rehabilitation Counseling", "Play Therapy", "Counseling Supervision"],
    },
    "social": {
        "basic": ["Statistics for the Social Sciences", "Social Research Methods", "Foundations of the Social Sciences"],
        "major": ["Social Theory", "Development Studies", "Public Policy Analysis", "Political Economy",
                  "Comparative Governance"],
        "cognate": ["Community Development", "Gender and Society", "Peace and Conflict Studies",
                    "Urban and Rural Sociology", "Social Movements", "Philippine History and Society",
                    "Demography and Population Studies", "Social Work Practice", "Environment and Society",
                    "Seminar on Contemporary Social Issues"],
    },
}

# suffix of the sheet column -> suggested semester (same wording as the MBA and DPSY curricula)
SUGGESTED_TERMS = {
    "STAT": "Year 1 - 1st Semester",
    "MOR": "Year 1 - 1st Semester",
    "FED": "Year 1 - 2nd Semester",
    "MAJ1": "Year 1 - 1st Semester",
    "MAJ2": "Year 1 - 2nd Semester",
    "MAJ3": "Year 2 - 1st Semester",
    "MAJ4": "Year 2 - 1st Semester",
    "MAJ5": "Year 2 - 2nd Semester",
    "COG1": "Year 1 - 2nd Semester",
    "COG2": "Year 1 - 2nd Semester",
    "COG3": "Year 2 - 1st Semester",
    "COG4": "Year 2 - 1st Semester",
    "COG5": "Year 2 - 1st Semester",
    "COG6": "Year 2 - 1st Semester",
    "COG7": "Year 2 - 2nd Semester",
    "COG8": "Year 2 - 2nd Semester",
    "COG9": "Year 2 - 2nd Semester",
    "COG10": "Year 2 - 2nd Semester",
}


def subject_title(program_code: str, suffix: str) -> str | None:
    """The demo title of one sheet column (suffix such as STAT, MAJ2, COG10), or None if unknown."""
    domain = PROGRAM_DOMAIN.get(program_code)
    titles = DOMAIN_TITLES.get(domain or "")
    if not titles:
        return None
    if suffix in ("STAT", "MOR", "FED"):
        return titles["basic"][("STAT", "MOR", "FED").index(suffix)]
    if suffix.startswith("MAJ") and suffix[3:].isdigit() and 1 <= int(suffix[3:]) <= 5:
        return titles["major"][int(suffix[3:]) - 1]
    if suffix.startswith("COG") and suffix[3:].isdigit() and 1 <= int(suffix[3:]) <= 10:
        return titles["cognate"][int(suffix[3:]) - 1]
    return None
