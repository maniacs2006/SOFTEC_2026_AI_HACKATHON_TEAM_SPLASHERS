import os
import json
from datetime import datetime
from pydantic import BaseModel, Field
from google import genai
from google.genai import types

# ---------------------------------------------------------------------------
# 1. Models (Pydantic Schemas)
# ---------------------------------------------------------------------------

class StudentProfile(BaseModel):
    degree_program: str
    semester: int
    cgpa: float
    skills_interests: list[str]
    preferred_opportunity_types: list[str]
    financial_need: bool
    location_preference: str
    past_experience: str

class OpportunityExtraction(BaseModel):
    is_opportunity: bool = Field(description="True if the email contains a genuine opportunity (scholarship, internship, etc.)")
    opportunity_type: str = Field(description="Type: Scholarship, Internship, Admission, Fellowship, Competition, etc.")
    opportunity_title: str = Field(description="Name or Title of the opportunity")
    deadline: str = Field(description="Deadline in YYYY-MM-DD format if available, else null")
    eligibility_conditions: list[str] = Field(description="List of explicitly stated eligibility criteria")
    required_documents: list[str] = Field(description="List of required documents for application")
    contact_info: str = Field(description="Application link, form URL, or contact details")
    summary: str = Field(description="A brief 1-2 sentence summary of the opportunity")

class ExtractedOpportunity(BaseModel):
    extraction: OpportunityExtraction
    original_email_id: str

# ---------------------------------------------------------------------------
# 2. Extraction Logic (AI Component)
# ---------------------------------------------------------------------------

def extract_opportunity(client: genai.Client, email_body: str) -> OpportunityExtraction:
    """Uses Gemini to extract structured opportunity fields from messy email text."""
    prompt = f"""
    Analyze the following email and extract the opportunity details.
    Determine if it is a real opportunity or just spam/noise.
    
    Email Content:
    {email_body}
    """
    
    # We use gemini-2.5-flash for fast and cost-effective structured extraction
    response = client.models.generate_content(
        model='gemini-2.5-flash',
        contents=prompt,
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            response_schema=OpportunityExtraction,
            temperature=0.1
        )
    )
    
    return OpportunityExtraction.model_validate_json(response.text)

# ---------------------------------------------------------------------------
# 3. Deterministic Scoring Logic
# ---------------------------------------------------------------------------

def calculate_score(opportunity: OpportunityExtraction, profile: StudentProfile) -> dict:
    """Evaluates profile fit, urgency, and completeness deterministically."""
    score = 0
    reasons = []
    
    # 3.1 Check Profile Fit (Preferences)
    if opportunity.opportunity_type.lower() in [pt.lower() for pt in profile.preferred_opportunity_types]:
        score += 30
        reasons.append(f"Strong fit: matches your preferred type '{opportunity.opportunity_type}'.")
    else:
        score += 10
        reasons.append(f"Opportunity type '{opportunity.opportunity_type}' is outside primary preferences.")
        
    # 3.2 Check Skills/Interests Match (Keyword Heuristic)
    matched_skills = []
    text_to_search = opportunity.summary.lower() + " " + " ".join(opportunity.eligibility_conditions).lower()
    for skill in profile.skills_interests:
        if skill.lower() in text_to_search:
            matched_skills.append(skill)
    
    if matched_skills:
        score += 15 * len(matched_skills)
        reasons.append(f"Profile match: Required skills align with your background ({', '.join(matched_skills)}).")
        
    # 3.3 CGPA / Academic Standing Check
    # Simple heuristic to see if GPA/CGPA is mentioned in requirements
    if any("cgpa" in cond.lower() or "gpa" in cond.lower() for cond in opportunity.eligibility_conditions):
        if profile.cgpa >= 3.5:
            score += 15
            reasons.append(f"Your high CGPA ({profile.cgpa}) strengthens your eligibility.")
        else:
            score += 5
            reasons.append("Check the specific CGPA requirements carefully.")
    
    # 3.4 Financial Need Bonus
    if profile.financial_need and opportunity.opportunity_type.lower() == "scholarship":
        score += 25
        reasons.append("High priority due to financial need matched with a scholarship.")
        
    # 3.5 Urgency Check (Deadline proximity)
    try:
        if opportunity.deadline and opportunity.deadline.lower() != "null":
            deadline_date = datetime.strptime(opportunity.deadline, "%Y-%m-%d")
            days_left = (deadline_date - datetime.now()).days
            
            if days_left < 0:
                score -= 100 # Deadline passed
                reasons.append("Deadline has likely passed.")
            elif days_left < 7:
                score += 40
                reasons.append(f"URGENT: Deadline is very soon (in {days_left} days).")
            elif days_left < 14:
                score += 20
                reasons.append(f"Upcoming deadline: {days_left} days remaining.")
            else:
                score += 5
                reasons.append(f"Comfortable timeline to apply ({days_left} days left).")
    except Exception:
        reasons.append("Deadline not mentioned or format unclear; verify manually.")

    return {
        "total_score": score,
        "reasons": reasons
    }

# ---------------------------------------------------------------------------
# 4. Main Copilot Engine
# ---------------------------------------------------------------------------

def process_inbox(client: genai.Client, emails: list[dict], profile: StudentProfile):
    valid_opportunities = []
    
    # Step A: AI Extraction
    print("--- 1. Scanning emails and extracting structured data... ---")
    for email in emails:
        print(f"Analyzing Email ID: {email['id']}...")
        ext = extract_opportunity(client, email['content'])
        if ext.is_opportunity:
            valid_opportunities.append(ExtractedOpportunity(
                extraction=ext,
                original_email_id=email['id']
            ))
            
    # Step B: Deterministic Scoring
    print("\n--- 2. Scoring and Ranking Opportunities... ---")
    results = []
    for opp in valid_opportunities:
        scoring_details = calculate_score(opp.extraction, profile)
        
        # Format actionable checklist
        docs = ", ".join(opp.extraction.required_documents) if opp.extraction.required_documents else "Check listing for required documents"
        next_steps = f"1. Prepare documents: {docs}\n2. Apply via: {opp.extraction.contact_info}"
        
        results.append({
            "email_id": opp.original_email_id,
            "title": opp.extraction.opportunity_title,
            "type": opp.extraction.opportunity_type,
            "deadline": opp.extraction.deadline,
            "score": scoring_details["total_score"],
            "why_it_matters": scoring_details["reasons"],
            "requirements": opp.extraction.eligibility_conditions,
            "action_checklist": next_steps
        })
        
    # Step C: Ranking (Highest score first)
    results.sort(key=lambda x: x["score"], reverse=True)
    
    return results

# ---------------------------------------------------------------------------
# 5. Demonstration / Test Flow
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # Validate API Key
    if not os.environ.get("GEMINI_API_KEY"):
        print("ERROR: GEMINI_API_KEY environment variable is missing.")
        print("Please set it using: export GEMINI_API_KEY='your_api_key'")
        exit(1)

    # Initialize Gemini Client
    client = genai.Client()
    
    # 1. Define Student Profile (Form-based fields)
    dummy_profile = StudentProfile(
        degree_program="BS Computer Science",
        semester=6,
        cgpa=3.6,
        skills_interests=["Machine Learning", "Python", "Data Science", "AI"],
        preferred_opportunity_types=["Internship", "Hackathon", "Competition"],
        financial_need=False,
        location_preference="Lahore or Remote",
        past_experience="Built a few web applications, familiar with Prompt Engineering."
    )
    
    # 2. Define Batch of Dummy Emails
    dummy_emails = [
        {
            "id": "email_001",
            "content": "Join the SOFTEC 2026 AI Hackathon in Lahore! Build an AI copilot to win cash prizes. Deadline to register is 2026-05-15. Must be an active university student. Apply at info@softecnu.org."
        },
        {
            "id": "email_002",
            "content": "Hey, just a reminder about the pizza party tomorrow at the CS department lounge. Grab a slice!"
        },
        {
            "id": "email_003",
            "content": "Google Summer Internship Programme 2026. Looking for CS juniors interested in Machine Learning and Python. Minimum CGPA required is 3.3. Please submit your CV and transcript by 2026-06-01 via google.com/careers."
        },
        {
            "id": "email_004",
            "content": "Need Funding? Apply for the National Need-Based Scholarship. Open to all students with financial hardships. Please complete the form and provide bank statements."
        }
    ]
    
    # 3. Process the Inbox
    ranked_opportunities = process_inbox(client, dummy_emails, dummy_profile)
    
    # 4. Display Results
    print("\n=======================================================")
    print(" 🚀 PERSONALIZED OPPORTUNITY RANKING (MVP RESULT) 🚀")
    print("=======================================================\n")
    
    for idx, opp in enumerate(ranked_opportunities, 1):
        print(f"Rank {idx} | Score: {opp['score']} | {opp['title']} ({opp['type']})")
        print(f"Deadline: {opp['deadline']}")
        
        print(f"\nWhy it matters (Evidence):")
        for reason in opp['why_it_matters']:
            print(f"  ✓ {reason}")
            
        print(f"\nRequirements:")
        for req in opp['requirements']:
            print(f"  - {req}")
            
        print("\nAction Checklist:")
        print(opp['action_checklist'])
        print("\n" + "="*50 + "\n")
