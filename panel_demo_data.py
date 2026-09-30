"""Demo data for Panel Matching (defense revision D1/D2, packet "panel").

Everything in this file is DEMONSTRATION data written for the capstone demo. It
is not real USLS faculty or student data (revision D3 is still waiting for the
stakeholder's real records). Every faculty evidence record seeded from here is
stored with source="demo seed" so it is always distinguishable from a record
entered in the portal. The file holds plain data only; app.py does the seeding.
"""

DEMO_SEED_SOURCE = "demo seed"

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

# Demo students in different programs and fields. Each has three concept papers
# (the title-defense package). "stage" is the Research Gate the student is
# waiting at: "title" = Form 1 (three concept papers); "proposal" = Form 4
# (title defense already passed, proposal manuscript uploaded). "title_panel"
# is the historical title-defense panel for students past the title defense.
PANEL_MATCHING_DEMO_STUDENTS = [
    {
        "student_number": "GS-2026-PM-01",
        "first_name": "Camille", "last_name": "Dizon",
        "program_code": "MSN", "adviser": "Dr. Teodoro Ramos", "stage": "title",
        "field": "nursing and health informatics",
        "case_title": "Text-Message Reminders and Medication Adherence among Adults with Hypertension",
        "concept_papers": [
            (
                "Text-Message Reminders and Medication Adherence among Adults with Hypertension",
                "This concept paper proposes a quasi-experimental study of automated text-message reminders and "
                "medication adherence among adult patients with hypertension in community health centers. "
                "Adherence will be measured with a validated questionnaire and pill counts, and blood pressure "
                "outcomes will be compared using logistic regression.",
            ),
            (
                "Nurse-Led Telehealth Follow-Up and Patient Education for Chronic Illness",
                "This concept paper examines nurse-led telehealth follow-up calls and patient education as ways to "
                "improve self-management among patients with hypertension and diabetes. A patient survey and "
                "interviews with staff nurses will describe barriers to treatment adherence in primary care.",
            ),
            (
                "Electronic Health Records and Nursing Documentation Quality in Primary Care Clinics",
                "This concept paper investigates how an electronic health record system affects the completeness of "
                "nursing documentation and patient safety reporting in primary care clinics, using a chart audit and "
                "a staff satisfaction survey.",
            ),
        ],
    },
    {
        "student_number": "GS-2026-PM-02",
        "first_name": "Rafael", "last_name": "Ocampo",
        "program_code": "MAPSY", "adviser": "Dr. Liwayway Bautista", "stage": "title",
        "field": "psychology and student well-being",
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
        "student_number": "GS-2026-PM-03",
        "first_name": "Jasper", "last_name": "Lorenzo",
        "program_code": "MSCS", "adviser": "Dr. Marlon Geronimo", "stage": "title",
        "field": "engineering systems and predictive maintenance",
        "case_title": "Vibration-Based Predictive Maintenance of CNC Machine Tools using Machine Learning",
        "concept_papers": [
            (
                "Vibration-Based Predictive Maintenance of CNC Machine Tools using Machine Learning",
                "This concept paper develops a predictive maintenance model that uses vibration sensor signals from "
                "CNC machine tools to predict bearing faults before failure. Machine learning classifiers will be "
                "trained on labeled sensor data and compared on fault detection accuracy.",
            ),
            (
                "Energy Consumption Optimization of Industrial Motors with IoT Sensors",
                "This concept paper measures the energy consumption of industrial motors on a production line with "
                "IoT sensors and builds a data model to identify energy waste and recommend optimization of motor "
                "operating schedules.",
            ),
            (
                "Anomaly Detection in Conveyor Systems using Sensor Data",
                "This concept paper applies anomaly detection to condition monitoring data from conveyor systems in "
                "a manufacturing plant to support automation and reduce unplanned downtime.",
            ),
        ],
    },
    {
        "student_number": "GS-2026-PM-04",
        "first_name": "Bea", "last_name": "Fontanilla",
        "program_code": "MBA", "adviser": "Dr. Angela Cruz", "stage": "title",
        "field": "financial technology",
        "case_title": "Trust, Perceived Risk, and E-Wallet Adoption among Young Working Adults",
        "concept_papers": [
            (
                "Trust, Perceived Risk, and E-Wallet Adoption among Young Working Adults",
                "This concept paper studies how trust and perceived risk influence the adoption of e-wallets and "
                "digital payment apps among young working adults, using a technology acceptance model and a "
                "survey of app users.",
            ),
            (
                "Digital Payment Usage and Savings Behavior of Micro-entrepreneurs",
                "This concept paper examines whether the use of digital payments and mobile banking changes the "
                "savings behavior and financial record keeping of micro-entrepreneurs in public markets.",
            ),
            (
                "Accounting Information Systems and Financial Reporting Quality in Small Enterprises",
                "This concept paper investigates how the adoption of cloud accounting information systems affects "
                "the quality of financial reporting and business analytics in small and medium enterprises.",
            ),
        ],
    },
    {
        "student_number": "GS-2026-PM-05",
        "first_name": "Miko", "last_name": "Almario",
        "program_code": "MBA", "adviser": "Dr. Paolo Navarro", "stage": "proposal",
        "field": "supply chain and operations",
        "case_title": "Demand Forecasting and Safety Stock Policy for a Consumer Goods Distributor",
        "title_panel": [
            ("Dr. Marco Villanueva", "Panel Chair"),
            ("Dr. Benjamin Reyes", "Content Specialist"),
            ("Dr. Teodoro Ramos", "Method Specialist"),
            ("Dr. Angela Cruz", "External Panel"),
        ],
        "concept_papers": [
            (
                "Demand Forecasting and Safety Stock Policy for a Consumer Goods Distributor",
                "This concept paper evaluates demand forecasting methods and safety stock policy for a regional "
                "consumer goods distributor to reduce stockouts and inventory holding cost in its supply chain.",
            ),
            (
                "Warehouse Order Picking Simulation to Reduce Cycle Time",
                "This concept paper uses discrete-event simulation to test warehouse layout and order picking "
                "rules and estimate the reduction in order cycle time and logistics cost.",
            ),
            (
                "Lean Six Sigma and Quality Improvement in Food Processing",
                "This concept paper applies Lean Six Sigma process improvement and quality systems to reduce "
                "defects and waste in a food processing plant.",
            ),
        ],
        "proposal_manuscript": (
            "The proposal applies demand forecasting and discrete-event simulation to evaluate safety stock and "
            "reorder policies for a regional consumer goods distributor. Twelve months of inventory and order "
            "records will be analyzed, forecast error will be compared across methods, and the simulated service "
            "level and holding cost of each policy will be reported to guide supply chain decisions."
        ),
    },
    {
        "student_number": "GS-2026-PM-06",
        "first_name": "Liza", "last_name": "Marquez",
        "program_code": "DBA", "adviser": "Dr. Benjamin Reyes", "stage": "proposal",
        "field": "family business and strategy",
        "case_title": "Succession Planning and Firm Continuity in Philippine Family Enterprises",
        "title_panel": [
            ("Dr. Angela Cruz", "Panel Chair"),
            ("Dr. Marco Villanueva", "Content Specialist 1"),
            ("Dr. Teresa Lim", "Content Specialist 2"),
            ("Dr. Teodoro Ramos", "Method Specialist"),
            ("Dr. Paolo Navarro", "External Panel"),
        ],
        "concept_papers": [
            (
                "Succession Planning and Firm Continuity in Philippine Family Enterprises",
                "This concept paper explores how succession planning and next-generation leadership affect the "
                "continuity of family-owned enterprises, using a multiple case study of three family businesses.",
            ),
            (
                "Governance Structures and Professionalization of Family Firms",
                "This concept paper studies family business governance, including family councils and boards, and "
                "how professionalization relates to strategic management and firm performance.",
            ),
            (
                "Entrepreneurial Orientation and Organizational Innovation in Second-Generation Firms",
                "This concept paper examines entrepreneurial orientation and organizational innovation among "
                "second-generation family firms and the role of strategy in renewing the business.",
            ),
        ],
        "proposal_manuscript": (
            "The proposal uses a multiple case study design to examine succession planning and governance in "
            "three Philippine family-owned enterprises. Interviews with founders, successors, and board members "
            "will be coded thematically to explain how next-generation leadership, family governance, and "
            "strategic renewal shape firm continuity across generations."
        ),
    },
    {
        "student_number": "GS-2026-PM-07",
        "first_name": "Nico", "last_name": "Baltazar",
        "program_code": "MBA", "adviser": "Dr. Angela Cruz", "stage": "title",
        "field": "digital marketing and consumer behavior",
        "case_title": "Influencer Credibility and Purchase Intention on Short-Video Platforms",
        "concept_papers": [
            (
                "Influencer Credibility and Purchase Intention on Short-Video Platforms",
                "This concept paper studies how influencer credibility and social media engagement shape the "
                "purchase intention of young consumers on short-video platforms, using an online survey and "
                "regression analysis.",
            ),
            (
                "Brand Equity and Customer Loyalty in Online Retail",
                "This concept paper examines brand equity, brand positioning, and customer loyalty among "
                "shoppers of online retail stores and electronic commerce platforms.",
            ),
            (
                "Customer Experience Journey in Online Grocery Shopping",
                "This concept paper maps the customer experience journey in online grocery shopping and links "
                "consumer behavior at each touchpoint to repeat purchases and digital marketing decisions.",
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
        "base": "GS-2026-PM-05", "student_number": "GS-2026-UD-01", "first_name": "Nico", "last_name": "Barrientos",
        "case_title": "Reorder Point Policies and Service Levels for a Regional Hardware Distributor",
        "days_ahead": 6, "start": "09:00", "end": "10:30", "mode": "In person", "venue": "Graduate School Conference Room",
    },
    {
        "base": "GS-2026-PM-06", "student_number": "GS-2026-UD-02", "first_name": "Bea", "last_name": "Salonga",
        "case_title": "Governance and Continuity Planning in Second-Generation Family Enterprises",
        "days_ahead": 11, "start": "13:30", "end": "15:30", "mode": "Online", "venue": "Zoom (link sent by the Graduate School)",
    },
    {
        "base": "GS-2026-PM-05", "student_number": "GS-2026-UD-03", "first_name": "Gab", "last_name": "Tolentino",
        "case_title": "Inventory Accuracy and Order Fulfilment Time in a Cold-Chain Warehouse",
        "days_ahead": 19, "start": "10:00", "end": "11:30", "mode": "In person", "venue": "Graduate School Conference Room",
    },
]
