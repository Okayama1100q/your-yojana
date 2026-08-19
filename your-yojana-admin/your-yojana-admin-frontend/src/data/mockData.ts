import type { Scheme } from "../types"

export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
  "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
  "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
  "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi", "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry"
]

export const MOCK_SCHEMES: Scheme[] = [
  {
    scheme_id: "SCH-001",
    scheme_name: "Madhya Pradesh Kalakar Evam Sahityakar Kalyan Kosh Niyam - Disability Assistance",
    state: "Madhya Pradesh",
    category: "Social Welfare & Empowerment",
    benefits: ["Financial assistance up to ₹5000/month", "Subsidized medical care"],
    required_documents: ["Aadhaar", "Disability Certificate", "Income Certificate", "Residence/Domicile Certificate"],
    ministry: "Department of Social Justice and Disabled Welfare",
    description: "Financial assistance for disabled artists and literary figures living in Madhya Pradesh.",
    eligibility_criteria: [
      "Must be a resident of Madhya Pradesh",
      "Must have a valid disability certificate",
      "Family annual income below ₹1,00,000"
    ],
    application_process: [
      "Fill out the application form online",
      "Upload required documents",
      "Verification by local authority"
    ],
    faqs: [
      { question: "How long does verification take?", answer: "Verification usually takes 15-30 days." }
    ]
  },
  {
    scheme_id: "SCH-002",
    scheme_name: "National Merit-cum-Means Scholarship",
    state: "Central",
    category: "Education",
    benefits: ["₹12,000 per annum for higher secondary education"],
    required_documents: ["Aadhaar", "Income Certificate", "Student/Enrollment Certificate", "Previous Year Marksheet"],
    ministry: "Ministry of Education",
    description: "Scholarship for meritorious students of economically weaker sections to arrest their drop out at class VIII and encourage them to continue the study at secondary stage.",
    eligibility_criteria: [
      "Must be a student enrolled in a recognized school",
      "Family income must be below ₹3,50,000 per annum"
    ],
    application_process: [
      "Apply through National Scholarship Portal",
      "School verification",
      "District verification"
    ],
    faqs: [
      { question: "Is this for college students?", answer: "No, this is specifically for classes 9 to 12." }
    ]
  },
  {
    scheme_id: "SCH-003",
    scheme_name: "Mahila Samridhi Yojana",
    state: "Central",
    category: "Women & Child",
    benefits: ["Micro-finance up to ₹1,40,000", "Skill training"],
    required_documents: ["Aadhaar", "Income Certificate", "BPL/Ration Card", "Bank Account Details"],
    ministry: "Ministry of Social Justice and Empowerment",
    description: "Micro-finance scheme for women from backward classes to start small businesses and improve livelihood.",
    eligibility_criteria: [
      "Must be female",
      "Belong to Backward Classes",
      "Family annual income below ₹3,00,000"
    ],
    application_process: [
      "Apply via State Channelizing Agencies (SCAs)",
      "Submit business plan",
      "Loan disbursement after approval"
    ],
    faqs: [
      { question: "Do I need collateral?", answer: "No collateral is required for loans up to ₹1,00,000." }
    ]
  },
  {
    scheme_id: "SCH-004",
    scheme_name: "Indira Gandhi National Old Age Pension Scheme",
    state: "Central",
    category: "Senior Citizens",
    benefits: ["₹200 - ₹500 monthly pension"],
    required_documents: ["Aadhaar", "Age Proof", "BPL/Ration Card"],
    ministry: "Ministry of Rural Development",
    description: "Financial assistance to senior citizens belonging to BPL households.",
    eligibility_criteria: [
      "Age must be 60 years or above",
      "Must belong to a BPL household"
    ],
    application_process: [
      "Submit application to Gram Panchayat or Municipality",
      "Verification by block officer"
    ],
    faqs: [
      { question: "How is the pension paid?", answer: "Direct Benefit Transfer (DBT) to the linked bank account." }
    ]
  },
  {
    scheme_id: "SCH-005",
    scheme_name: "Deen Dayal Upadhyaya Grameen Kaushalya Yojana",
    state: "Central",
    category: "Employment & Skill Development",
    benefits: ["Free skill training", "Placement assistance"],
    required_documents: ["Aadhaar", "Residence/Domicile Certificate", "Education Certificates"],
    ministry: "Ministry of Rural Development",
    description: "Skill training program for rural youth aiming at employment.",
    eligibility_criteria: [
      "Age 15-35 years",
      "Rural resident",
      "Poor family background preferred"
    ],
    application_process: [
      "Register at nearest Kaushal Panjee center",
      "Attend counseling and select course",
      "Complete training and get placed"
    ],
    faqs: [
      { question: "Are meals provided?", answer: "Yes, uniform, course material, and boarding/lodging are free for residential courses." }
    ]
  }
]
