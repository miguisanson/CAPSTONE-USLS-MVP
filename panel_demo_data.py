"""Demo data for Panel Matching (defense revision D1/D2, packet "panel").

Everything in this file is DEMONSTRATION data written for the capstone demo. It
is not real USLS faculty or student data (revision D3 is still waiting for the
stakeholder's real records). Every faculty evidence record seeded from here is
stored with source="demo seed" so it is always distinguishable from a record
entered in the portal. The file holds plain data only; app.py does the seeding.
"""

DEMO_SEED_SOURCE = "demo seed"

# Demo data cleanup (owner 2026-11-22, IM54-IM56; .planning/DATA-CLEANUP-PLAN.md). The seed imports every monitoring
# sheet (each program keeps its curriculum) but keeps only these imported students; each carries a case on a board, the
# Research Gate or a Dean screen. Every demo persona below (DEMO_STUDENT_NUMBERS) stays.
DEMO_KEPT_SHEET_STUDENTS = frozenset({
    "2260004",  # Miguel Yu (student@): research, panels, defenses, verdicts
    "2260007",  # Isabel Flores: graduation For Review
    "2260011",  # Elena Mendoza: residency, Research Gate missing requirements
    "2360006",  # Adrian Lim: withdrawal for staff; at risk (Monitoring tour)
    "2360008",  # Hector Ong: graduation list with the Dean
    "2360010",  # Paulo Garcia: AWOL declared
    "2460003",  # Benjamin Santos: leave for staff
    "2460005",  # Clarisse Tan: AWOL return for staff
    "2460009",  # Maria Dela Cruz: readmission for staff
    "2560001",  # Daniel Cruz: new admission handoff
    "2560002",  # Grace Reyes: early coursework
    "2360101",  # Isabel Mendoza (MAPSY): practicum report with the Dean
    "2360092",  # Nicole Alvarez (MAPSY): practicum hours check
})
# Seven faculty (IM56: the kept students need 33 adviser seats at five each). The tours sign in as the first three.
DEMO_FACULTY = (
    "Dr. Liwayway Bautista", "Dr. Angela Cruz", "Dr. Celeste Tan",
    "Dr. Teodoro Ramos", "Dr. Patricia Salvador", "Dr. Marlon Geronimo", "Dr. Benjamin Reyes",
)
# Data cleanup stage 4 (2026-11-22, amends IM55's three logins, for the owner to confirm): every faculty member signs in,
# because a defense panel member must have an active faculty login (defense_faculty_directory, the panel invitation),
# so with three logins the four other faculty could sit on no panel and Change panel offered three people.
DEMO_FACULTY_LOGINS = frozenset(DEMO_FACULTY)

# One mapping table for the seeded demo personas (I-353). Every number is exactly 7 digits and sits in the 269xxxx
# block, which no imported student uses (the sheets use 226/236/246/256). Tests, e2e specs, walkthroughs and the
# demo guides name the same numbers; change one here and run: grep -rn <old number> .
DEMO_STUDENT_NUMBERS = {
    "PM-01": "2690101",
    "PM-02": "2690102",
    "PM-03": "2690103",
    "PM-04": "2690104",
    "PM-05": "2690105",
    "PM-06": "2690106",
    "PM-07": "2690107",
    "PRAC-01": "2690201",
    "PRAC-02": "2690202",
    "PRAC-03": "2690203",  # stage-ready practicum students (seed_stage_ready_cases), one per practicum step
    "PRAC-04": "2690204",
    "PRAC-05": "2690205",
    "PRAC-06": "2690206",
    "PRAC-07": "2690207",
    "PRAC-08": "2690208",
    "PRAC-09": "2690209",
    "GRAD-01": "2690301",
    "GRAD-02": "2690302",
    "GRAD-03": "2690303",  # Dean-approved batch, ready for the Dean's export (no sign-in of their own)
    "GRAD-04": "2690304",
    "GRAD-05": "2690305",  # stage-ready candidates (seed_stage_ready_cases): application submitted, coursework,
    "GRAD-06": "2690306",  # research and endorsement-prep batches, so every Graduation step can be shown by hand
    "GRAD-07": "2690307",
    "GRAD-08": "2690308",
    "WD-01": "2690401",
    "WD-02": "2690402",
    "WD-03": "2690403",  # IM54 (2026-11-22): the two Withdrawal step cards (subject tagging, Excel export), MAED, with a
    "WD-04": "2690404",  # sign-in, now that the imported students the seed used to pick have no portal login
    "ENR-01": "2690501",
    "ENR-02": "2690502",
    "HO-01": "2690601",
    "HO-02": "2690602",
    "CA-01": "2690701",
    "CA-02": "2690702",
    "LOA-01": "2690801",
    "LOA-02": "2690802",
    "READ-01": "2690901",
    "READ-02": "2690902",
    "AWOL-01": "2691001",
    "RES-01": "2691101",
    "UD-01": "2691201",
    "UD-02": "2691202",
    "UD-03": "2691203",
    # IM56 (2026-11-22): the Dean's cases, held by MAED demo students (they replace imported students of other programs).
    "DEAN-01": "2691301",
    "DEAN-02": "2691302",
    "DEAN-03": "2691303",
    "DEAN-04": "2691304",
    "DEAN-05": "2691305",
    "DEAN-06": "2691306",
}

# The Dean's demo cases (app.seed_dean_review_cases): MAED students with a sign-in, each holding one case.
DEAN_DEMO_PERSONAS = {
    "leave-of-absence": (DEMO_STUDENT_NUMBERS["DEAN-01"], "Rowena", "Gatchalian"),         # LOA with the Dean
    "readmission": (DEMO_STUDENT_NUMBERS["DEAN-02"], "Joaquin", "Lizares"),                # on leave, readmission with the Dean
    "awol-return": (DEMO_STUDENT_NUMBERS["DEAN-03"], "Carmela", "Jison"),                  # AWOL, return declaration with the Dean
    "withdrawal": (DEMO_STUDENT_NUMBERS["DEAN-04"], "Enzo", "Araneta"),                    # subject withdrawal with the Dean
    "leave-of-absence-decided": (DEMO_STUDENT_NUMBERS["DEAN-05"], "Mariel", "Yulo"),       # LOA the Dean approved
    "withdrawal-decided": (DEMO_STUDENT_NUMBERS["DEAN-06"], "Kevin", "Locsin"),            # withdrawal the Dean denied
}

# IM57 (owner 2026-11-22): a small history, so the Reports compare with the two earlier terms (app.seed_report_history).
# MAED coursework students with no current case and no sign-in; each holds one decided case or one held defense of an
# earlier term. The two practicum ones are MSGC (MAED has no practicum).
HISTORY_DEMO_STUDENTS = (
    ("2691401", "Alyssa", "Bermejo"),
    ("2691402", "Bryan", "Catalan"),
    ("2691403", "Christine", "Dumalagan"),
    ("2691404", "Dennis", "Escalona"),
    ("2691405", "Ella", "Fuentebella"),
    ("2691406", "Francis", "Gaston"),
    ("2691407", "Gemma", "Hilado"),
    ("2691408", "Harold", "Inocencio"),
    ("2691409", "Iris", "Jamora"),
    ("2691410", "Jerome", "Katalbas"),
    ("2691411", "Karen", "Lopue"),
    ("2691412", "Lester", "Montinola"),
    ("2691413", "Monica", "Nolasco"),
    ("2691414", "Neil", "Ortaliz"),
)
HISTORY_PRACTICUM_STUDENTS = (
    ("2691417", "Pia", "Quisumbing"),
    ("2691418", "Ronald", "Sarrosa"),
)

# The Withdrawal step cards (seed_stage_ready_cases), in STAGE_READY_WITHDRAWAL order.
STAGE_READY_WITHDRAWAL_STUDENTS = (
    (DEMO_STUDENT_NUMBERS["WD-03"], "Kristine", "Villafuerte"),
    (DEMO_STUDENT_NUMBERS["WD-04"], "Ramil", "Jalandoni"),
)

# (kind, text, year) per faculty member. Kinds: research_interest, publication,
# past_advisee_title, past_panel_title, degree. The roster's own SPECIALIZATION
# text stays on Faculty.specialization and is used as evidence too.
FACULTY_EXPERTISE_DEMO = {
    "Dr. Liwayway Bautista": [
        ("research_interest", "Learning analytics dashboards that give graduate students feedback on their participation in online courses", None),
        ("research_interest", "Student engagement, motivation, and persistence in online and blended graduate programs", None),
        ("publication", "Dashboard feedback, self-regulated learning, and engagement in online graduate courses: a mixed-method study", 2022),
        ("publication", "Interaction traces from a learning management system as indicators of student participation", 2020),
        ("past_advisee_title", "Learning Analytics Adoption among Graduate School Instructors", 2023),
        ("past_panel_title", "Blended Learning Engagement of Working Graduate Students", 2024),
        ("degree", "PhD in Educational Technology", None),
    ],
    "Dr. Marlon Geronimo": [
        ("research_interest", "Educational data mining and predictive modeling of student performance and attrition", None),
        ("research_interest", "Machine learning classifiers for early identification of at-risk learners", None),
        ("research_interest", "Predictive modeling applied to education, health, and business records", None),
        ("publication", "Random forest and logistic regression models for predicting course failure in online programs", 2023),
        ("publication", "Feature selection from clickstream logs for student dropout prediction", 2021),
        ("past_advisee_title", "Predicting Thesis Completion Delay using Machine Learning on Graduate Records", 2022),
        ("past_panel_title", "Neural Network Forecasting of Board Examination Performance", 2024),
        ("degree", "PhD in Computer Science, data mining specialization", None),
    ],
    "Dr. Patricia Salvador": [
        ("research_interest", "Online pedagogy and instructional design for graduate teaching", None),
        ("research_interest", "Learning management system adoption and curriculum development in higher education", None),
        ("publication", "Designing an outcomes-based curriculum for online graduate courses", 2022),
        ("publication", "Faculty readiness and learning management system use in teacher education programs", 2019),
        ("past_advisee_title", "Instructional Design Framework for Asynchronous Teacher Training Modules", 2023),
        ("past_panel_title", "Curriculum Alignment of a Master of Arts in Education Program", 2024),
        ("degree", "EdD in Curriculum and Instruction", None),
    ],
    "Dr. Teodoro Ramos": [
        ("research_interest", "Mixed-method research design, including sequential explanatory studies", None),
        ("research_interest", "Case study and qualitative research designs, including multiple case study and interview coding", None),
        ("research_interest", "Development and validation of survey instruments, reliability testing, and factor analysis", None),
        ("publication", "Content validity and internal consistency of a graduate student satisfaction questionnaire", 2022),
        ("publication", "Thematic coding procedures for interview data: an audit trail approach", 2020),
        ("past_advisee_title", "Validation of a Self-Efficacy Scale for Filipino Graduate Students", 2023),
        ("past_panel_title", "Regression and Structural Equation Modeling of Teacher Job Satisfaction", 2024),
        ("degree", "PhD in Research and Evaluation", None),
    ],
    "Dr. Adriana Santos": [
        ("research_interest", "Health informatics and nursing information systems, including electronic health records", None),
        ("research_interest", "Medication adherence, patient education, and telehealth follow-up for adults with chronic illness", None),
        ("publication", "Text-message reminders and medication adherence among patients with hypertension in community clinics", 2023),
        ("publication", "Data quality of public health surveillance reports in barangay health centers", 2021),
        ("past_advisee_title", "Nurse Documentation Workload after Adoption of an Electronic Medical Record", 2023),
        ("past_panel_title", "Patient Safety Culture among Staff Nurses in a Tertiary Hospital", 2024),
        ("degree", "PhD in Nursing", None),
    ],
    "Dr. Benjamin Reyes": [
        ("research_interest", "Financial technology adoption, digital wallets, and consumer savings behavior", None),
        ("research_interest", "Accounting information systems and business analytics for small and medium enterprises", None),
        ("research_interest", "Financial management and performance of family-owned small and medium enterprises", None),
        ("publication", "Perceived risk and trust in e-wallet adoption among young working adults", 2023),
        ("publication", "Digital payment usage and household savings behavior in the Philippines", 2021),
        ("past_advisee_title", "Mobile Banking Acceptance among Micro-entrepreneurs", 2022),
        ("past_panel_title", "Credit Risk Modeling for Rural Bank Loan Portfolios", 2024),
        ("degree", "DBA in Finance", None),
    ],
    "Dr. Celeste Tan": [
        ("research_interest", "Academic motivation, student well-being, and burnout in higher education", None),
        ("research_interest", "Behavioral research using structured interviews and validated psychological scales", None),
        ("research_interest", "Health psychology, including patient motivation and adherence to treatment and behavior change", None),
        ("publication", "Academic burnout, coping strategies, and psychological well-being of graduate students", 2022),
        ("publication", "Intrinsic motivation and persistence of adult learners: an interview study", 2020),
        ("past_advisee_title", "Stress, Resilience, and Help-Seeking Behavior among Nursing Students", 2023),
        ("past_panel_title", "Self-Determination and Study Habits of Senior High School Students", 2024),
        ("degree", "PhD in Educational Psychology", None),
    ],
    "Dr. Daniel Uy": [
        ("research_interest", "Industrial automation, programmable controllers, and sensor-based condition monitoring", None),
        ("research_interest", "Predictive maintenance, energy optimization, and fault detection in manufacturing systems", None),
        ("publication", "Vibration signal analysis for bearing fault prediction using machine learning", 2023),
        ("publication", "Energy consumption modeling and optimization of a bottling plant", 2021),
        ("past_advisee_title", "Predictive Maintenance Scheduling for Conveyor Motors using IoT Sensors", 2022),
        ("past_panel_title", "Solar-Assisted Cold Chain Monitoring System", 2024),
        ("degree", "PhD in Mechanical Engineering", None),
    ],
    "Dr. Angela Cruz": [
        ("research_interest", "Strategic management, entrepreneurship, and organizational innovation in small firms", None),
        ("research_interest", "Family business governance, succession planning, and next-generation leadership", None),
        ("publication", "Succession planning and firm continuity in Philippine family-owned enterprises: a multiple case study", 2023),
        ("publication", "Entrepreneurial orientation and business model innovation among family firms", 2020),
        ("past_advisee_title", "Governance Practices of Third-Generation Family Enterprises", 2022),
        ("past_panel_title", "Strategic Renewal in Regional Retail Chains", 2024),
        ("degree", "DBA in Strategic Management", None),
    ],
    "Dr. Marco Villanueva": [
        ("research_interest", "Supply chain analytics, inventory control, and logistics network optimization", None),
        ("research_interest", "Operations research, quality systems, and process improvement using simulation", None),
        ("research_interest", "Equipment reliability and maintenance scheduling in manufacturing operations", None),
        ("publication", "Demand forecasting and safety stock policy for a fast-moving consumer goods distributor", 2022),
        ("publication", "Discrete-event simulation of warehouse order picking to reduce cycle time", 2020),
        ("past_advisee_title", "Inventory Optimization for a Regional Pharmaceutical Distributor", 2023),
        ("past_advisee_title", "Operations Improvement in a Family-Owned Distribution Company", 2021),
        ("past_panel_title", "Lean Six Sigma Implementation in a Food Manufacturing Plant", 2024),
        ("degree", "PhD in Industrial Engineering", None),
    ],
    "Dr. Teresa Lim": [
        ("research_interest", "Digital marketing, social media engagement, and brand positioning", None),
        ("research_interest", "Consumer behavior, electronic commerce, and online purchase intention", None),
        ("publication", "Influencer credibility and purchase intention on short-video platforms", 2023),
        ("publication", "Brand equity and customer loyalty in online retail", 2021),
        ("past_advisee_title", "Social Media Advertising Effectiveness for Local Coffee Shops", 2022),
        ("past_advisee_title", "Branding Strategy of Family-Owned Retail Businesses", 2021),
        ("past_panel_title", "Customer Experience Journey in Online Grocery Shopping", 2024),
        ("degree", "DBA in Marketing", None),
    ],
    "Dr. Paolo Navarro": [
        ("research_interest", "Human resource management, employee retention, and turnover intention", None),
        ("research_interest", "Organizational behavior, leadership development, and workplace well-being", None),
        ("research_interest", "Leadership succession and management development in growing organizations", None),
        ("publication", "Transformational leadership, job satisfaction, and turnover intention among hospital staff", 2022),
        ("publication", "Work-life balance and burnout among call center employees", 2020),
        ("past_advisee_title", "Employee Engagement Programs and Retention in Manufacturing Firms", 2023),
        ("past_panel_title", "Leadership Competencies of Middle Managers in Public Schools", 2024),
        ("degree", "PhD in Industrial and Organizational Psychology", None),
    ],
}

# Demo students waiting at the Research Gate (IM56, 2026-11-22: all MAED, with education theses that the demo faculty's
# expertise matches). Each has three concept papers (the title-defense package). "stage" is the Research Gate the
# student is waiting at: "title" = Form 1 (three concept papers); "proposal" = Form 4 (title defense already passed,
# proposal manuscript uploaded). "title_panel" is the historical title-defense panel for students past the title defense.
PANEL_MATCHING_DEMO_STUDENTS = [
    {
        "student_number": DEMO_STUDENT_NUMBERS["PM-01"],
        "first_name": "Camille", "last_name": "Dizon",
        "program_code": "MAED", "adviser": "Dr. Teodoro Ramos", "stage": "title",
        "field": "teacher well-being and school health",
        "case_title": "Teacher Burnout, Coping, and Well-Being in Public Senior High Schools",
        "concept_papers": [
            (
                "Teacher Burnout, Coping, and Well-Being in Public Senior High Schools",
                "This concept paper measures burnout, coping strategies, and psychological well-being of public "
                "senior high school teachers using validated scales and a survey of teachers in one division.",
            ),
            (
                "School-Based Health Programs and Student Attendance in Public Elementary Schools",
                "This concept paper studies how school feeding, health screening, and wellness programs relate to "
                "student attendance and readiness to learn in public elementary schools.",
            ),
            (
                "Mental Health Literacy and Help-Seeking of Junior High School Students",
                "This concept paper examines mental health literacy, stigma, and help-seeking behavior among junior "
                "high school students and the role of guidance services in schools.",
            ),
        ],
    },
    {
        "student_number": DEMO_STUDENT_NUMBERS["PM-02"],
        "first_name": "Rafael", "last_name": "Ocampo",
        "program_code": "MAED", "adviser": "Dr. Liwayway Bautista", "stage": "title",
        "field": "student well-being in graduate education",
        "case_title": "Academic Burnout, Coping, and Psychological Well-Being of Working Graduate Students",
        "concept_papers": [
            (
                "Academic Burnout, Coping, and Psychological Well-Being of Working Graduate Students",
                "This concept paper examines academic burnout and coping strategies among working graduate students "
                "and how they relate to psychological well-being. A validated burnout scale and structured "
                "interviews will describe stress, exhaustion, and coping across the semester.",
            ),
            (
                "Intrinsic Motivation and Persistence of Adult Learners in Graduate Programs",
                "This concept paper applies self-determination theory to the motivation and persistence of adult "
                "learners in graduate programs, looking at autonomy, competence, and supportive relationships "
                "through a survey and follow-up interviews.",
            ),
            (
                "Peer Support, Help-Seeking Behavior, and Stress among Graduate Students",
                "This concept paper studies peer support and help-seeking behavior as buffers against stress and "
                "burnout among graduate students, using a psychological well-being questionnaire and thematic "
                "analysis of interviews.",
            ),
        ],
    },
    {
        "student_number": DEMO_STUDENT_NUMBERS["PM-03"],
        "first_name": "Jasper", "last_name": "Lorenzo",
        "program_code": "MAED", "adviser": "Dr. Marlon Geronimo", "stage": "title",
        "field": "educational data mining and learning analytics",
        "case_title": "Early Warning Models for Graduate Student Attrition using Learning Management System Data",
        "concept_papers": [
            (
                "Early Warning Models for Graduate Student Attrition using Learning Management System Data",
                "This concept paper builds an early warning model with machine learning classifiers on learning "
                "management system activity and grades to identify graduate students at risk of dropping out.",
            ),
            (
                "Predicting Licensure Examination Performance of Education Graduates",
                "This concept paper applies predictive modeling to academic records of education graduates to "
                "estimate their performance in the licensure examination for teachers.",
            ),
            (
                "Learning Analytics Dashboards and Course Completion in Blended Graduate Classes",
                "This concept paper studies whether learning analytics dashboards that show participation and "
                "progress improve course completion in blended graduate classes.",
            ),
        ],
    },
    {
        "student_number": DEMO_STUDENT_NUMBERS["PM-04"],
        "first_name": "Bea", "last_name": "Fontanilla",
        "program_code": "MAED", "adviser": "Dr. Angela Cruz", "stage": "title",
        "field": "school finance and financial literacy",
        "case_title": "Financial Literacy Instruction and Savings Behavior of Senior High School Students",
        "concept_papers": [
            (
                "Financial Literacy Instruction and Savings Behavior of Senior High School Students",
                "This concept paper evaluates how a financial literacy module in senior high school, including the "
                "use of digital wallets, changes the savings behavior and money management of students.",
            ),
            (
                "Budgeting and Financial Management Practices of Private School Administrators",
                "This concept paper examines how administrators of small private schools plan budgets, manage tuition "
                "collections, and use accounting information systems for decisions.",
            ),
            (
                "Entrepreneurship Education and Entrepreneurial Intention of Technical-Vocational Students",
                "This concept paper studies the effect of entrepreneurship education on the entrepreneurial intention "
                "and small business plans of technical-vocational students.",
            ),
        ],
    },
    {
        "student_number": DEMO_STUDENT_NUMBERS["PM-05"],
        "first_name": "Miko", "last_name": "Almario",
        "program_code": "MAED", "adviser": "Dr. Marlon Geronimo", "stage": "proposal",
        "field": "school finance and resource management",
        "case_title": "Tuition Collection Practices and Financial Sustainability of Small Private Schools",
        "title_panel": [
            ("Dr. Angela Cruz", "Panel Chair"),
            ("Dr. Patricia Salvador", "Content Specialist"),
            ("Dr. Teodoro Ramos", "Method Specialist"),
            ("Dr. Liwayway Bautista", "External Panel"),
        ],
        "concept_papers": [
            (
                "Tuition Collection Practices and Financial Sustainability of Small Private Schools",
                "This concept paper analyzes tuition collection practices, cash flow, and reserves of small private "
                "schools to explain their financial sustainability and the use of accounting information systems.",
            ),
            (
                "Resource Allocation and Learning Outcomes in Public Secondary Schools",
                "This concept paper relates how school maintenance and operating funds are allocated to learning "
                "materials, facilities, and teacher training with the learning outcomes of students.",
            ),
            (
                "Cost-Effectiveness of Remedial Reading Programs in Elementary Schools",
                "This concept paper compares the cost and effect of remedial reading programs in elementary schools "
                "to guide school administrators in choosing interventions.",
            ),
        ],
        "proposal_manuscript": (
            "The proposal analyzes five years of tuition collection, cash flow, and reserve records of twelve "
            "small private schools in Negros Occidental. Collection practices will be compared across schools, "
            "interviews with administrators will explain the differences, and the financial sustainability of "
            "each practice will be reported to guide school owners and administrators."
        ),
    },
    {
        "student_number": DEMO_STUDENT_NUMBERS["PM-06"],
        "first_name": "Liza", "last_name": "Marquez",
        "program_code": "MAED", "adviser": "Dr. Benjamin Reyes", "stage": "proposal",
        "field": "school leadership and succession",
        "case_title": "Leadership Succession and Continuity in Family-Owned Private Schools",
        "title_panel": [
            ("Dr. Angela Cruz", "Panel Chair"),
            ("Dr. Celeste Tan", "Content Specialist 1"),
            ("Dr. Patricia Salvador", "Content Specialist 2"),
            ("Dr. Teodoro Ramos", "Method Specialist"),
            ("Dr. Liwayway Bautista", "External Panel"),
        ],
        "concept_papers": [
            (
                "Leadership Succession and Continuity in Family-Owned Private Schools",
                "This concept paper explores how succession planning and next-generation leadership affect the "
                "continuity of family-owned private schools, using a multiple case study of three schools.",
            ),
            (
                "Governance Structures and Professionalization of Family-Run Schools",
                "This concept paper studies the governance of family-run schools, including boards and family "
                "councils, and how professionalization relates to school management and performance.",
            ),
            (
                "Innovation and Strategic Planning in Second-Generation Private Schools",
                "This concept paper examines how second-generation owners of private schools use strategic planning "
                "and organizational innovation to renew their schools.",
            ),
        ],
        "proposal_manuscript": (
            "The proposal uses a multiple case study design to examine succession planning and governance in "
            "three family-owned private schools in Bacolod City. Interviews with founders, successors, and school "
            "board members will be coded thematically to explain how next-generation leadership, family "
            "governance, and strategic renewal shape the continuity of each school."
        ),
    },
    {
        "student_number": DEMO_STUDENT_NUMBERS["PM-07"],
        "first_name": "Nico", "last_name": "Baltazar",
        "program_code": "MAED", "adviser": "Dr. Angela Cruz", "stage": "title",
        "field": "online pedagogy and instructional design",
        "case_title": "Instructional Design of Short-Video Lessons and Learner Engagement in Blended Classes",
        "concept_papers": [
            (
                "Instructional Design of Short-Video Lessons and Learner Engagement in Blended Classes",
                "This concept paper studies how short-video lessons designed with instructional design principles "
                "affect learner engagement and participation in blended graduate classes.",
            ),
            (
                "Learning Management System Adoption among Faculty of a Private University",
                "This concept paper examines the factors that influence the adoption of a learning management system "
                "by faculty, using a technology acceptance model and a faculty survey.",
            ),
            (
                "Online Discussion Design and Critical Thinking of Graduate Students",
                "This concept paper compares structured and open online discussion designs and their effect on the "
                "critical thinking shown in graduate students' posts.",
            ),
        ],
    },
]


# Upcoming defenses for the calendars, the faculty dashboard and the reminders (demo mode only).
# Each entry is a demonstration student cloned from a proposal-stage Panel Matching student
# ("base"): same program, adviser and panel, but a new person and a Proposal Defense booked
# "days_ahead" days from today. The seeder keeps the date in the future on every start.
UPCOMING_DEFENSE_DEMO = [
    {
        "base": DEMO_STUDENT_NUMBERS["PM-06"], "student_number": DEMO_STUDENT_NUMBERS["UD-01"], "first_name": "Nico", "last_name": "Barrientos",
        "case_title": "Budget Planning and Resource Allocation in Small Private Schools",
        # IM56 (2026-11-22): a master's thesis panel of four seats, as the booked defense had before the cleanup
        "title_panel": [
            ("Dr. Angela Cruz", "Panel Chair"),
            ("Dr. Celeste Tan", "Content Specialist"),
            ("Dr. Teodoro Ramos", "Method Specialist"),
            ("Dr. Liwayway Bautista", "External Panel"),
        ],
        "days_ahead": 6, "start": "09:00", "end": "10:30", "mode": "On-site", "venue": "Graduate School Conference Room",
    },
    {
        "base": DEMO_STUDENT_NUMBERS["PM-06"], "student_number": DEMO_STUDENT_NUMBERS["UD-02"], "first_name": "Bea", "last_name": "Salonga",
        "case_title": "Governance and Succession Planning in Family-Run Basic Education Schools",
        "days_ahead": 11, "start": "13:30", "end": "15:30", "mode": "Online", "venue": "Zoom (link sent by the Graduate School)",
    },
    {
        "base": DEMO_STUDENT_NUMBERS["PM-06"], "student_number": DEMO_STUDENT_NUMBERS["UD-03"], "first_name": "Gab", "last_name": "Tolentino",
        "case_title": "Fee Collection Practices and Financial Sustainability of Parochial Schools",
        # IM56 (2026-11-22): a master's thesis panel of four seats, as the booked defense had before the cleanup
        "title_panel": [
            ("Dr. Angela Cruz", "Panel Chair"),
            ("Dr. Celeste Tan", "Content Specialist"),
            ("Dr. Teodoro Ramos", "Method Specialist"),
            ("Dr. Liwayway Bautista", "External Panel"),
        ],
        "days_ahead": 19, "start": "10:00", "end": "11:30", "mode": "On-site", "venue": "Graduate School Conference Room",
    },
]


# Research advisers of the workflow demo students (I-060). The faculty limit is 5 advisees each
# (business rule faculty.max_advisees), so the demo cohort is spread over five faculty members, and
# an adviser never sits on the panel of their own advisee. Students that panel-matching demo data
# places (2690101 to 2690107) and the sheet students keep the adviser they were seeded with.
# IM56: Dr. Daniel Uy is not in the demo roster. Stage 4: the kept students name 56 advisers and seven faculty hold 35
# seats, so the fallback adviser is over the limit, as Dr. Daniel Uy was; not Dr. Angela Cruz, whom the Dean appoints
# under the limit in the adviser walkthrough (p63).
DEMO_ADVISER_FALLBACK = "Dr. Patricia Salvador"
DEMO_PANEL_REPLACEMENT = "Dr. Celeste Tan"
DEMO_STUDENT_ADVISERS = {
    # Dr. Liwayway Bautista (5 with 2690102, who is placed by PANEL_MATCHING_DEMO_STUDENTS)
    "2260007": "Dr. Liwayway Bautista",
    DEMO_STUDENT_NUMBERS["READ-01"]: "Dr. Liwayway Bautista",
    DEMO_STUDENT_NUMBERS["READ-02"]: "Dr. Liwayway Bautista",
    DEMO_STUDENT_NUMBERS["AWOL-01"]: "Dr. Liwayway Bautista",
    # Dr. Marlon Geronimo (4 with 2690103)
    DEMO_STUDENT_NUMBERS["WD-01"]: "Dr. Marlon Geronimo",
    DEMO_STUDENT_NUMBERS["WD-02"]: "Dr. Marlon Geronimo",
    DEMO_STUDENT_NUMBERS["ENR-01"]: "Dr. Marlon Geronimo",
    # Dr. Patricia Salvador
    DEMO_STUDENT_NUMBERS["ENR-02"]: "Dr. Patricia Salvador",
    DEMO_STUDENT_NUMBERS["HO-01"]: "Dr. Patricia Salvador",
    DEMO_STUDENT_NUMBERS["HO-02"]: "Dr. Patricia Salvador",
    DEMO_STUDENT_NUMBERS["CA-01"]: "Dr. Patricia Salvador",
    DEMO_STUDENT_NUMBERS["CA-02"]: "Dr. Patricia Salvador",
    # Dr. Teodoro Ramos (5 with 2690101)
    DEMO_STUDENT_NUMBERS["LOA-01"]: "Dr. Teodoro Ramos",
    DEMO_STUDENT_NUMBERS["LOA-02"]: "Dr. Teodoro Ramos",
    DEMO_STUDENT_NUMBERS["GRAD-01"]: "Dr. Teodoro Ramos",
    DEMO_STUDENT_NUMBERS["GRAD-02"]: "Dr. Teodoro Ramos",
    # Dr. Celeste Tan: not on the panel of the MAED research cohort, so she can advise its members
    "2260004": "Dr. Celeste Tan",
    "2360008": "Dr. Celeste Tan",
    DEMO_STUDENT_NUMBERS["PRAC-01"]: "Dr. Celeste Tan",
    DEMO_STUDENT_NUMBERS["PRAC-02"]: "Dr. Celeste Tan",
    DEMO_STUDENT_NUMBERS["RES-01"]: "Dr. Celeste Tan",
}


# Roster students in a research stage who keep NO research adviser (F-25), so the Reports "Records to fix" tab shows a
# short list instead of every research student. The first five are the students the adviser walkthrough works with
# (frontend/e2e/p63-faculty-pages.spec.js applies for an adviser as Gian, Daniel, Rafael and Marielle, and uploads
# Form 1 as Elena); the rest are students still at the title stage (Proposal Development).
# IM57 (2026-11-22): the four students of the adviser walkthrough (p63) are MAED demo students now, with the same names
# and sign-ins as the imported students they replace (app.ensure_adviser_application_students makes them).
# (number, first, last, stage, title, the three concept papers' subject)
ADVISER_APPLICATION_STUDENTS = (
    ("2691501", "Gian", "Reyes", "Data Collection",
     "Financial Literacy and Digital Payment Use of Public School Teachers",
     "teachers' financial literacy, digital wallets and cashless payments in public schools"),
    ("2691502", "Daniel", "Bernardo", "Proposal Defense",
     "Strategic Renewal and Innovation in Third-Generation Family-Owned Schools",
     "governance, succession and program innovation in family-owned private schools"),
    ("2691503", "Rafael", "Pang", "Proposal Defense",
     "Instructional Leadership of School Heads and Teacher Morale",
     "the instructional leadership of school heads and its link to teacher morale and retention"),
    ("2691504", "Marielle", "Navarro", "Data Collection",
     "Curriculum Alignment of a Teacher Education Program with National Standards",
     "mapping a teacher education curriculum against national professional standards for teachers"),
)
# The student home's "nothing waiting" case (frontend/e2e/p70): a MAED coursework student with every subject done,
# nothing enrolled this semester and no request, with a sign-in. Replaces Ana Chua (EDD), with the same name and login.
QUIET_DEMO_STUDENT = ("2691505", "Ana", "Chua")
# Imported students the walkthroughs sign in as (p63 files Form 1 for Elena Mendoza); IM54 gave imported students none.
WALKTHROUGH_LOGIN_STUDENTS = ("2260011",)
ROSTER_WITHOUT_ADVISER = frozenset({
    "2691501",  # Gian Reyes
    "2691502",  # Daniel Bernardo
    "2691503",  # Rafael Pang
    "2691504",  # Marielle Navarro
    "2260011",  # Elena Mendoza
    "2560025",  # Noel Abad
    "2360041",  # Ben Bautista
    "2560093",  # Nicole Dizon
    "2360115",  # Grace Tan
    "2360090",  # Fatima Santos
})

# The adviser the walkthrough appoints (p63: the Dean appoints Dr. Angela Cruz for Daniel Bernardo with no "over the limit"
# warning) keeps one seat free, so the seed never fills her to the advisee limit.
ROSTER_ADVISER_SPARE_SEAT = frozenset({"Dr. Angela Cruz"})


# Research topics for the roster students who reach the research stages without a paper of their own (I-145).
# One list per program; a student takes the topic at their position in the program, and the next two as the other
# two concept papers of the package. Demonstration text, not real student work; stored as the student's uploaded
# concept papers so Panel Matching has something different to read for each of them.
ROSTER_RESEARCH_TOPICS = {
    "MAED": [
        ("Peer Feedback and Writing Quality among Senior High School Students",
         "This concept paper examines how structured peer feedback changes the writing quality of senior high school students in English classes. A rubric-scored pre-test and post-test, classroom observation, and student interviews will describe curriculum fit and instructional design."),
        ("Blended Learning Readiness of Public School Teachers",
         "This concept paper studies the readiness of public school teachers for blended learning, covering learning management system use, training needs, and instructional design. A survey and teacher interviews will inform a professional development plan."),
        ("Formative Assessment Practices in Mathematics Classrooms",
         "This concept paper investigates formative assessment practices of mathematics teachers and their link to student engagement. Classroom observation and a teacher questionnaire will be analyzed with descriptive statistics and regression."),
        ("Parental Involvement and Reading Outcomes of Grade 3 Pupils",
         "This concept paper looks at parental involvement in home reading and the reading outcomes of Grade 3 pupils. A parent survey and reading test scores will be correlated, with follow-up interviews on school-family communication."),
    ],
    "EDD": [
        ("Instructional Leadership of School Heads and Teacher Morale",
         "This concept paper explores the instructional leadership of school heads and its relation to teacher morale and job satisfaction. A validated questionnaire and interviews with teachers will describe leadership practices and organizational climate."),
        ("Curriculum Alignment of a Teacher Education Program with National Standards",
         "This concept paper evaluates how well the courses of a teacher education program are aligned with national professional standards. Document analysis and a faculty survey will identify gaps in curriculum development and assessment."),
        ("Mentoring of Beginning Teachers in Private Schools",
         "This concept paper describes the mentoring support given to beginning teachers in private schools, using a multiple case study with interviews and observation to understand retention, motivation, and professional growth."),
        ("Learning Management System Adoption among College Instructors",
         "This concept paper examines the adoption of a learning management system by college instructors, focusing on online pedagogy, digital readiness, and student engagement, using a mixed-method survey and interviews."),
    ],
    "MSGC": [
        ("Help-Seeking Behavior and Counseling Services among Junior High School Students",
         "This concept paper studies why junior high school students do or do not seek counseling services. A help-seeking questionnaire and interviews with guidance counselors will describe barriers, stress, and peer support."),
        ("Career Decision Self-Efficacy of Senior High School Learners",
         "This concept paper examines career decision self-efficacy among senior high school learners and the effect of a group guidance program. A validated scale will be given before and after the program."),
        ("Bullying, Resilience, and Well-Being of Grade 8 Students",
         "This concept paper investigates the relationship between experiences of bullying, resilience, and psychological well-being among Grade 8 students, using a standardized scale and structured interviews."),
        ("Family Support and Motivation of First-Generation College Students",
         "This concept paper describes how family support relates to the academic motivation and persistence of first-generation college students, using a survey and an interview study."),
    ],
    "MAN": [
        ("Nurse Staffing and Patient Safety Culture in Provincial Hospitals",
         "This concept paper examines nurse staffing levels and patient safety culture in provincial hospitals. A validated safety culture survey and incident report review will be analyzed with regression to guide nursing management."),
        ("Burnout and Turnover Intention of Staff Nurses in Emergency Rooms",
         "This concept paper studies burnout, work-life balance, and turnover intention among emergency room staff nurses, using a burnout inventory and interviews with nurse managers on leadership and retention."),
        ("Health Education for Mothers on Childhood Immunization",
         "This concept paper evaluates a community health education program for mothers on childhood immunization, measuring knowledge, attitudes, and vaccination follow-up in barangay health centers."),
        ("Nursing Informatics Competence of Clinical Nurses",
         "This concept paper assesses the informatics competence of clinical nurses and their use of electronic medical records, looking at documentation quality, training needs, and patient safety."),
    ],
    "MSN": [
        ("Text-Message Follow-Up and Diabetes Self-Management in Community Clinics",
         "This concept paper tests whether text-message follow-up improves diabetes self-management and medication adherence among adults in community clinics, using a quasi-experimental design and a validated adherence questionnaire."),
        ("Nurse-Led Patient Education and Wound Care Outcomes",
         "This concept paper examines nurse-led patient education on home wound care and its effect on infection and readmission after surgery. Patient records and a follow-up survey will be analyzed."),
        ("Electronic Handover and Communication Errors among Staff Nurses",
         "This concept paper evaluates an electronic nursing handover tool and its effect on communication errors and patient safety, using a chart audit and a staff satisfaction survey."),
        ("Stress and Coping of Nursing Students during Clinical Exposure",
         "This concept paper describes stress, coping strategies, and help-seeking of nursing students during clinical exposure, using a stress scale and interviews."),
    ],
    "MSCS": [
        ("Anomaly Detection in Server Logs using Machine Learning",
         "This concept paper compares machine learning classifiers for detecting anomalies in server logs, including feature selection from log traces, with precision and recall measured on labeled incidents from a university data center."),
        ("Predicting Student Course Failure from Learning Management System Data",
         "This concept paper applies predictive modeling and educational data mining to learning management system clickstream data in order to identify students at risk of failing a course."),
        ("Sensor-Based Fault Prediction for Water Pump Maintenance",
         "This concept paper uses vibration and temperature sensors with machine learning to predict faults in water pumps, supporting predictive maintenance and energy optimization for a local utility."),
        ("Usability of a Mobile Health Reminder Application",
         "This concept paper designs and evaluates a mobile reminder application for medication adherence, measuring usability, accuracy, and user satisfaction with a prototype and a survey."),
    ],
    "MIT": [
        ("Information Security Awareness among University Employees",
         "This concept paper measures information security awareness and phishing susceptibility among university employees and tests a short training program with a pre-test and post-test."),
        ("Adoption of Cloud Accounting Systems by Small Enterprises",
         "This concept paper studies the adoption of cloud accounting information systems by small and medium enterprises, using a technology acceptance model survey and interviews with owners."),
        ("Chatbot Support for Student Enrollment Inquiries",
         "This concept paper develops and tests a chatbot that answers student enrollment inquiries, comparing response accuracy and student satisfaction against the current help desk."),
        ("Process Automation in a Manufacturing Plant Using Programmable Controllers",
         "This concept paper proposes industrial automation with programmable controllers and sensors to reduce downtime, measuring energy use and production cycle time before and after implementation."),
    ],
    "MBA": [
        ("E-Wallet Adoption and Perceived Risk among Young Working Adults",
         "This concept paper examines trust, perceived risk, and financial technology adoption of e-wallets among young working adults, using a survey analyzed with regression and attention to digital payment and savings behavior."),
        ("Inventory Control and Order Fulfillment in a Distribution Company",
         "This concept paper studies inventory control, demand forecasting, and safety stock in a distribution company, using simulation of order fulfillment to reduce stockouts and logistics cost."),
        ("Social Media Marketing and Purchase Intention of Local Coffee Shops",
         "This concept paper investigates how social media marketing, brand image, and influencer credibility affect consumer purchase intention for local coffee shops, using a consumer survey."),
        ("Employee Engagement and Retention in Call Center Companies",
         "This concept paper explores employee engagement, leadership, and turnover intention in call center companies, using a validated questionnaire and interviews with supervisors."),
        ("Succession Planning in Family-Owned Retail Businesses",
         "This concept paper describes succession planning and governance practices of family-owned retail businesses, using a multiple case study and interviews with founders and next-generation leaders."),
        ("Lean Process Improvement in a Food Manufacturing Plant",
         "This concept paper applies lean and quality improvement methods to a food manufacturing plant, using process simulation to cut cycle time and waste while tracking equipment reliability."),
    ],
    "DBA": [
        ("Digital Payment Ecosystems and the Financial Inclusion of Micro-Entrepreneurs",
         "This concept paper studies digital payment adoption, financial technology services, and the savings and credit access of micro-entrepreneurs, using a large survey and structural equation modeling."),
        ("Strategic Renewal and Innovation in Third-Generation Family Firms",
         "This concept paper investigates strategic renewal, entrepreneurial orientation, and business model innovation in third-generation family firms, using a multiple case study of governance and leadership succession."),
        ("Brand Equity and Customer Loyalty in Online Retail",
         "This concept paper tests a model of brand equity, customer experience, and loyalty in online retail, using a consumer survey of purchase intention and repeat purchase."),
        ("Supply Chain Resilience of Regional Manufacturers",
         "This concept paper examines supply chain resilience, logistics network design, and inventory policy of regional manufacturers after disruption, using analytics and interviews with operations managers."),
    ],
    "MAPSY": [
        ("Academic Burnout, Coping, and Well-Being of Working Graduate Students",
         "This concept paper examines academic burnout and coping strategies among working graduate students and how they relate to psychological well-being, using a validated burnout scale and structured interviews."),
        ("Intrinsic Motivation and Persistence of Adult Learners",
         "This concept paper applies self-determination theory to the motivation and persistence of adult learners in higher education, looking at autonomy, competence, and supportive relationships."),
        ("Workplace Stress and Work-Life Balance of Hospital Employees",
         "This concept paper studies workplace stress, work-life balance, and job satisfaction of hospital employees, using psychological scales and interviews on leadership and organizational support."),
        ("Social Media Use, Self-Esteem, and Anxiety among College Students",
         "This concept paper investigates the relationship between social media use, self-esteem, and anxiety among college students, using standardized psychological scales and a short interview study."),
        ("Health Behavior Change and Treatment Adherence among Patients with Hypertension",
         "This concept paper explores the psychological factors of treatment adherence and health behavior change among patients with hypertension, using a motivation questionnaire and structured interviews."),
        ("Resilience and Help-Seeking Behavior of Senior High School Students",
         "This concept paper describes resilience, stress, and help-seeking behavior of senior high school students, using a validated resilience scale and peer support interviews."),
    ],
    "MASS": [
        ("Community Participation in Barangay Disaster Preparedness",
         "This concept paper studies community participation in barangay disaster preparedness planning, using a household survey and interviews with barangay officials about governance and local capacity."),
        ("Migration, Remittances, and Household Livelihood in Rural Communities",
         "This concept paper examines how migration and remittances affect household livelihood, education spending, and savings in rural communities, using a household survey and key informant interviews."),
        ("Social Media and Political Participation of First-Time Voters",
         "This concept paper explores how social media use shapes the political participation and information habits of first-time voters, using a survey and focus group discussions."),
        ("Youth Volunteerism and Civic Engagement in Local Government Projects",
         "This concept paper describes youth volunteerism and civic engagement in local government projects, using a mixed-method design with a youth survey and case study interviews."),
    ],
    "DPSY": [
        ("Psychological Well-Being and Burnout of Graduate School Faculty",
         "This concept paper studies psychological well-being, burnout, and motivation of graduate school faculty, using validated scales and interviews."),
        ("Leadership Style and Employee Engagement in Public Schools",
         "This concept paper examines transformational leadership, employee engagement, and turnover intention in public schools using a survey and structured interviews."),
        ("Coping and Treatment Adherence among Adults with Chronic Illness",
         "This concept paper explores coping strategies, patient motivation, and adherence to treatment among adults with chronic illness using psychological scales and interviews."),
        ("Self-Regulated Learning and Academic Persistence in Online Programs",
         "This concept paper investigates self-regulated learning, motivation, and persistence of students in online programs, using a validated scale and learning management system participation data."),
    ],
}
