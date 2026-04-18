import { Terminal, Loader2, User, Inbox, Trash2, CheckSquare, AlertTriangle, Target, Filter, Mail, ListOrdered } from "lucide-react";
import React, { useState, useEffect } from "react";
import { GoogleGenAI } from "@google/genai";

const INITIAL_EMAILS = [
  "Hey students! Don't forget the SOFTEC 2026 AI Hackathon is coming up. Complete an AI copilot project to win cash prizes! Open to all Computer Science majors. Deadline is May 25, 2026. Register at https://softecnu.org/register.",
  "From the Registrar: Please be reminded that your tuition fees for the Spring 2026 semester are due next Friday. Failure to pay will result in a hold on your account.",
  "Google Summer Internship Programme! We are looking for Juniors specifically interested in Machine Learning and Data Science. Minimum CGPA required is 3.5. Apply by June 1, 2026 at https://careers.google.com/students.",
  "Need Funding? Apply for the National Need-Based Tech Scholarship. Open to all students with financial hardships. Please complete the form by May 30th. Link: https://scholarships.national.org/apply",
  "Cybersecurity Capture The Flag competition. Open to all undergraduates. Weekend event with prizes up to $5000. Registration closes this Monday. Don't miss out!",
  "Are you looking for a Remote part-time job? We are hiring Junior Web Developers for a local agency. 15 hours a week. Send your resume to hiring@localagency.net.",
  "Amazon SDE Full-Time Role. We are hiring graduating seniors for Advanced Full-Time Software Engineering roles. Relocation required. Good programming experience needed.",
  "Calling all aspiring UI/UX Designers! Join our Local Campus UI/UX Design Workshop this Friday. Suitable for Beginners with absolutely no experience.",
  "Global Blockchain Innovation Fellowship. A fully funded fellowship for students highly skilled in Blockchain. Requires open availability to relocate to Switzerland.",
  "Campus library overdue book notice. Please return 'Introduction to Algorithms' by May 5th to avoid late fees.",
  "Local agency seeks Mobile Development Intern. Gain hands-on experience building iOS and Android apps. You must reside locally and work from our downtown campus office.",
  "Data Science Kaggle Competition! Compete entirely Remote. Huge cash prizes for the best predictive models. Open to all skill levels.",
  "Finance Tech Startup is recruiting a Part-Time Remote engineer. Familiarity with Cloud Computing and Finance systems is a major plus.",
  "Summer Game Jam! 48-hour remote Game Development Hackathon. Sign up on Itch.io. Open to all experience levels.",
  "Housing Office: Fall 2026 dormitory applications open next week. Please complete your registration via the student portal."
];

const INTEREST_OPTIONS = [
  "Machine Learning", "Data Science", "Artificial Intelligence", 
  "Web Development", "Mobile Development", "Cybersecurity", 
  "Cloud Computing", "UI/UX Design", "Game Development", "Blockchain", "Finance"
];

const PREFERRED_OPTIONS = [
  "Internship", "Hackathon", "Scholarship", "Fellowship", "Competition", "Part-Time Job", "Full-Time Job"
];

const LOCATION_OPTIONS = ["Remote Only", "Local Only", "Open to Relocation", "Remote or Local"];

const EXPERIENCE_OPTIONS = ["Beginner (No experience)", "Intermediate (Built personal projects)", "Advanced (Previous internships)"];

export default function App() {
  const [inboxEmails, setInboxEmails] = useState<string[]>(INITIAL_EMAILS);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [rankedResults, setRankedResults] = useState<{ accepted: any[], ignored: any[] } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  // Listen for OAuth Success from Popup
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const origin = event.origin;
      if (!origin.endsWith('.run.app') && !origin.includes('localhost')) {
        return;
      }
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        const token = event.data.token;
        setAccessToken(token);
        fetchGmailInbox(token);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleConnectGmail = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const response = await fetch(`/api/auth/url?origin=${encodeURIComponent(window.location.origin)}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Failed to get auth URL' }));
        throw new Error(data.error || 'Failed to get auth URL');
      }
      const { url } = await response.json();
      const authWindow = window.open(url, 'oauth_popup', 'width=600,height=700');
      if (!authWindow) {
         setErrorMsg('Please allow popups for this site to connect your account.');
      }
    } catch (error: any) {
      setErrorMsg("OAuth Integration Error: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchGmailInbox = async (token: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/gmail/fetch?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        const errRes = await res.json();
        throw new Error(errRes.error || "Failed to fetch from Gmail API");
      }
      const data = await res.json();
      if (data.emails && data.emails.length > 0) {
        setInboxEmails(data.emails);
      } else {
        setErrorMsg("Your inbox is empty or couldn't parse contents.");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Student Profile State
  const [profile, setProfile] = useState({
    studentName: "Alex Rivera",
    degreeProgram: "BS Computer Science",
    semester: "6",
    cgpa: "3.6",
    skillsInterests: ["Machine Learning", "Data Science", "Artificial Intelligence"],
    preferredTypes: ["Internship", "Hackathon", "Part-Time Job"],
    financialNeed: true,
    locationPreference: "Remote or Local",
    pastExperience: "Intermediate (Built personal projects)"
  });

  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    let parsedValue: string | boolean = type === "checkbox" ? (e.target as HTMLInputElement).checked : value;
    
    if (name === "cgpa" && typeof parsedValue === "string") {
      if (parseFloat(parsedValue) > 4.0) parsedValue = "4.0";
      if (parseFloat(parsedValue) < 2.0 && parsedValue.toString().length > 2) parsedValue = "2.0";
    }

    setProfile(prev => ({ ...prev, [name]: parsedValue }));
  };

  const handleRemoveEmail = (index: number) => {
    setInboxEmails(prev => prev.filter((_, i) => i !== index));
  };

  const calculateScore = (opp: any, studentProfile: typeof profile) => {
    let score = 0;
    let reasons: string[] = [];

    // Base validation
    if (!opp.is_valid_opportunity) {
       return { score: 0, reasons: ["Email is not recognized as a valid opportunity."] };
    } else {
       score += 10;
    }

    const { degreeProgram, cgpa, skillsInterests, preferredTypes, financialNeed, locationPreference, pastExperience } = studentProfile;
    const targetText = ((opp.eligibility || '') + ' ' + (opp.description || '')).toLowerCase();

    // 1. Keyword/Interest match
    let interestMatches = 0;
    const interests = skillsInterests.map(s => s.toLowerCase());
    
    if (interests.length > 0) {
       // Search target text and keywords
       const matches = interests.filter(interest => 
          targetText.includes(interest) || 
          (opp.keywords && opp.keywords.some((kw: string) => kw.toLowerCase().includes(interest) || interest.includes(kw.toLowerCase())))
       );
       
       if (matches.length > 0) {
         interestMatches = matches.length;
         score += 20 * matches.length;
         reasons.push(`Strong match with your selected interests (${matches.join(', ')}).`);
       }
    } else {
       interestMatches = 1; // Passed if no interests array provided
    }

    // 2. Degree match
    if (degreeProgram && targetText.includes(degreeProgram.toLowerCase())) {
       score += 30;
       reasons.push(`Specifically targeting students in ${degreeProgram}.`);
    }

    // 3. Preferred Types
    let prefMatches = 0;
    const prefs = preferredTypes.map(s => s.toLowerCase());
    
    if (prefs.length > 0) {
       if (opp.type && prefs.some(p => opp.type.toLowerCase().includes(p))) {
         score += 20;
         prefMatches = 1;
         reasons.push(`Opportunity type (${opp.type}) aligns perfectly with your structured preferences.`);
       } else if (prefs.some(p => targetText.includes(p))) {
         score += 10;
         prefMatches = 1;
         reasons.push(`Description matches your preferred opportunity type.`);
       }
    } else {
       prefMatches = 1; // Passed if no preference specified
    }

    // 4. Financial Need
    if (financialNeed && opp.type && opp.type.toLowerCase().includes('scholarship')) {
       score += 40;
       reasons.push("High priority match based on your stated financial need and scholarship matching.");
    }

    // 5. CGPA Check
    if ((targetText.includes('cgpa') || targetText.includes('gpa'))) {
       if (parseFloat(cgpa) >= 3.5) {
         score += 15;
         reasons.push(`Your high CGPA (${cgpa}) strengthens your application. Meets strict academic filters.`);
       } else {
         score += 5;
         reasons.push("Requires minimum academic standing. Check strict metrics carefully.");
       }
    }

    // 6. Urgency (Simple heuristic if date contains "May" or "June" just for demo)
    if (opp.deadline) {
      score += 10;
      reasons.push(`Upcoming deadline highlighted: ${opp.deadline}.`);
    }

    // 7. Location & Experience Scoring
    const targetDesc = targetText;
    let locationMatches = 0;
    
    // Check location
    if (locationPreference.includes("Remote") && targetDesc.includes("remote")) {
      score += 10;
      locationMatches = 1;
      reasons.push("Matches your preference for remote work environments.");
    } else if (locationPreference === "Local Only" && !targetDesc.includes("remote")) {
      locationMatches = 1; // Assuming it is local if not explicitly remote
    } else if (locationPreference === "Open to Relocation" || locationPreference === "Remote or Local") {
      locationMatches = 1; // Permissive
    } else if (targetDesc.includes("local") || targetDesc.includes("relocation") || targetDesc.includes("on-site")) {
      locationMatches = 1; // If it's local and preference is remote, it might fail. But let's be graceful unless strictly contradictory.
    }
    
    if (locationPreference === "Remote Only" && (targetDesc.includes("local only") || targetDesc.includes("in-person") || targetDesc.includes("on-site"))) {
      locationMatches = 0; // Strict contradiction
    } else {
      locationMatches = 1; // Default pass for implicit matches
    }
    
    let experienceMatches = 0;
    if (pastExperience.includes("Beginner") && (targetDesc.includes("beginner") || targetDesc.includes("no experience"))) {
      score += 5;
      experienceMatches = 1;
      reasons.push("Suitable for beginners as per your experience level.");
    } else if (pastExperience.includes("Beginner") && (targetDesc.includes("advanced") || targetDesc.includes("senior"))) {
      experienceMatches = 0; // Strict contradiction
    } else {
      experienceMatches = 1; 
    }
    
    if (pastExperience.includes("Advanced") && (targetDesc.includes("advanced") || targetDesc.includes("experience required"))) {
       score += 10;
       experienceMatches = 1;
       reasons.push("Opportunity demands advanced skills matching your profile.");
    }

    if (reasons.length === 0) {
       reasons.push("Opportunity is valid, but no strong customized matches were found in your profile vectors.");
    }

    return { score, reasons, interestMatches, prefMatches, locationMatches, experienceMatches };
  };

  const buildActionChecklist = (opp: any) => {
     const steps = ["Review the formal eligibility criteria precisely to ensure full qualification."];
     if (opp.link) steps.push(`Visit the official opportunity application portal: ${opp.link}`);
     if (opp.deadline) steps.push(`Prepare and submit all required institutional documents before the cutoff limit: ${opp.deadline}.`);
     return steps;
  };

  const handleProcessInboxBatch = async () => {
    const emailsToProcess = inboxEmails;
    
    if (emailsToProcess.length === 0) {
      setErrorMsg("No emails in the inbox to process.");
      return;
    }
    
    setLoading(true);
    setLoadingProgress(0);
    setRankedResults(null);
    setErrorMsg(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const promptBase = `You are an AI assistant helping university students find relevant opportunities.
Read the following email. If it is spam, a generic newsletter, or not a tangible opportunity (like an internship, hackathon, scholarship), set 'is_valid_opportunity' to false. Otherwise, extract the details into valid JSON.

JSON Schema:
{
  "is_valid_opportunity": boolean,
  "type": string | null,
  "title": string | null,
  "organization": string | null,
  "description": string | null,
  "eligibility": string | null,
  "deadline": string | null,
  "link": string | null,
  "keywords": string[] | null
}

Email content:
`;

      const results: any[] = [];
      let completed = 0;

      // Parallel chunk processing to massively speed up execution while guarding against strict rate limits
      const CHUNK_SIZE = 5; 
      for (let i = 0; i < emailsToProcess.length; i += CHUNK_SIZE) {
        const chunk = emailsToProcess.slice(i, i + CHUNK_SIZE);
        
        const chunkPromises = chunk.map(async (email) => {
          try {
            const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview',
              contents: promptBase + email,
              config: {
                responseMimeType: "application/json",
                temperature: 0.1
              }
            });

            const cleanJson = (response.text || "").replace(/```json/g, '').replace(/```/g, '').trim() || "{}";
            const parsed = JSON.parse(cleanJson);

            if (parsed.is_valid_opportunity) {
              const scoring = calculateScore(parsed, profile);
              if (scoring.interestMatches > 0 && scoring.prefMatches > 0 && scoring.locationMatches > 0 && scoring.experienceMatches > 0) {
                 return { opp: parsed, score: scoring.score, reasons: scoring.reasons, original_email: email, targetStatus: 'accepted' };
              } else {
                 return { opp: parsed, score: scoring.score, reasons: ["Filtered out due to strict profile mismatch constraints (not taking correct degree, GPA, or invalid interest/location)."], original_email: email, targetStatus: 'ignored' };
              }
            } else {
               return { opp: parsed, score: 0, reasons: ["Determined by AI strictly to be non-opportunity noise (spam, bills, event alerts, etc)."], original_email: email, targetStatus: 'ignored' };
            }
          } catch (innerErr) {
            console.error("Single email parse failed:", innerErr);
          }
          return null;
        });

        const chunkResults = await Promise.all(chunkPromises);
        
        chunkResults.forEach(res => {
           if (res) results.push(res);
        });

        completed += chunk.length;
        setLoadingProgress(Math.round((completed / emailsToProcess.length) * 100));
      }

      // Final Rank descending
      const accepted = results.filter(r => r.targetStatus === 'accepted').sort((a, b) => b.score - a.score);
      const ignored = results.filter(r => r.targetStatus === 'ignored');
      setRankedResults({ accepted, ignored });

    } catch (error: any) {
      setErrorMsg(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white font-sans flex flex-col overflow-y-auto w-full">
      <header className="px-6 md:px-[60px] pt-[40px] pb-[20px] flex justify-between items-end flex-shrink-0">
        <h1 className="text-[60px] md:text-[110px] leading-[0.85] font-[800] tracking-[-4px] uppercase m-0">
          Copilot
        </h1>
        <div className="font-mono text-[14px] text-[#D1FF26] pb-[10px] text-right">
          <div>v4.0.0 - BATCH_INBOX</div>
          {profile.studentName && <div className="text-white mt-1 uppercase text-[12px] opacity-70">User: {profile.studentName}</div>}
        </div>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-[minmax(300px,1fr)_minmax(350px,1.2fr)_minmax(400px,1.5fr)] gap-[2px] flex-grow bg-[#242427] mt-[20px] border-t border-[#242427] h-full overflow-hidden">
        
        {/* Left Column: Raw Inbox */}
        <section className="bg-[#0A0A0B] p-6 flex flex-col overflow-y-auto custom-scrollbar h-full lg:max-h-[calc(100vh-200px)]">
          <div className="bg-[#141416] border border-[#242427] p-6 lg:p-[30px] font-mono flex flex-col h-full relative">
            <div className="flex items-center gap-3 mb-6 border-b border-[#242427] pb-4">
              <div className="w-8 h-8 flex items-center justify-center text-[#D1FF26]">
                <Inbox size={24} />
              </div>
              <h2 className="font-sans text-[18px] font-bold tracking-tight text-white m-0 uppercase">Raw Email Capture</h2>
            </div>
            
            <p className="font-sans text-[#7C7C7C] mb-6 text-[13px] leading-relaxed">
              These unordered simulated emails contain noise and valid opportunities. They are analyzed during triage.
            </p>

            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 mb-6 justify-between border-b border-[#242427] pb-6">
              <button 
                onClick={handleConnectGmail} 
                disabled={loading}
                className="bg-[#242427] hover:bg-[#34343a] text-white px-[20px] py-[12px] font-[700] uppercase border-none text-[12px] transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap w-full"
              >
                 <Mail size={16} /> Sync Live Gmail
              </button>
            </div>

            <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar space-y-4">
               {inboxEmails.map((email, idx) => {
                 return (
                 <div key={idx} className="bg-[#0A0A0B] p-4 border border-[#242427] flex flex-col gap-2 group">
                    <span className="text-[10px] uppercase tracking-wider text-[#7c7c7c] border-b border-[#242427] pb-2 text-left">Message ID_00{idx+1} <span className="float-right text-[#555]">Source: POP3</span></span>
                    <div className="text-[#d4d4d4] text-[12px] leading-relaxed break-words whitespace-pre-wrap">
                       {email}
                    </div>
                    <button onClick={() => handleRemoveEmail(idx)} className="self-end text-[#7c7c7c] hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 cursor-pointer bg-transparent border-none p-1 -mt-2">
                      <Trash2 size={14} />
                    </button>
                 </div>
                 );
               })}
               
               {inboxEmails.length === 0 && (
                 <div className="text-center p-8 border border-dashed border-[#242427] text-[#7C7C7C] text-[12px]">
                    Directory empty. Waiting for POP3 fetch.
                 </div>
               )}
            </div>
          </div>
        </section>

        {/* Middle Column: Configuration */}
        <section className="bg-[#0A0A0B] p-6 lg:p-[40px] flex flex-col gap-8 overflow-y-auto custom-scrollbar h-full lg:max-h-[calc(100vh-200px)] border-l border-[#242427]">
          
          {/* Section 1: Student Profile */}
          <div className="bg-[#141416] border border-[#242427] p-6 lg:p-[30px] font-mono flex flex-col">
            <div className="flex items-center gap-3 mb-6 border-b border-[#242427] pb-4">
              <div className="w-8 h-8 flex items-center justify-center text-[#D1FF26]">
                <User size={24} />
              </div>
              <h2 className="font-sans text-[20px] font-bold tracking-tight text-white m-0 uppercase">Student Profile Configuration</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-[13px] text-[#d4d4d4]">
              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[#7C7C7C] uppercase tracking-wider text-[11px]">Student Name</label>
                <input name="studentName" value={profile.studentName} onChange={handleProfileChange} className="bg-[#0A0A0B] border border-[#242427] p-3 focus:outline-none focus:border-[#D1FF26] transition-colors" />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[#7C7C7C] uppercase tracking-wider text-[11px]">Degree Program (Department)</label>
                <select name="degreeProgram" value={profile.degreeProgram} onChange={handleProfileChange} className="bg-[#0A0A0B] border border-[#242427] p-3 focus:outline-none focus:border-[#D1FF26] transition-colors text-[#d4d4d4] cursor-pointer w-full">
                  <option value="BS Computer Science">BS Computer Science</option>
                  <option value="BS Software Engineering">BS Software Engineering</option>
                  <option value="BS Data Science">BS Data Science</option>
                  <option value="BS Artificial Intelligence">BS Artificial Intelligence</option>
                  <option value="BS Electrical Engineering">BS Electrical Engineering</option>
                  <option value="BBA Business Administration">BBA Business Administration</option>
                  <option value="BA Media Studies">BA Media Studies</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[#7C7C7C] uppercase tracking-wider text-[11px]">Semester</label>
                <select name="semester" value={profile.semester} onChange={handleProfileChange} className="bg-[#0A0A0B] border border-[#242427] p-3 focus:outline-none focus:border-[#D1FF26] transition-colors text-[#d4d4d4] cursor-pointer w-full">
                  <option value="1">1st Semester</option>
                  <option value="2">2nd Semester</option>
                  <option value="3">3rd Semester</option>
                  <option value="4">4th Semester</option>
                  <option value="5">5th Semester</option>
                  <option value="6">6th Semester</option>
                  <option value="7">7th Semester</option>
                  <option value="8">8th Semester</option>
                </select>
              </div>

              <div className="flex flex-col gap-2 relative">
                <label className="text-[#7C7C7C] uppercase tracking-wider text-[11px]">CGPA (2.0 - 4.0)</label>
                <input name="cgpa" type="number" step="0.1" min="2.0" max="4.0" value={profile.cgpa} onChange={handleProfileChange} className="bg-[#0A0A0B] border border-[#242427] p-3 focus:outline-none focus:border-[#D1FF26] transition-colors" />
              </div>
              <div className="flex flex-col gap-2 justify-center">
                 <label className="flex items-center gap-3 cursor-pointer pt-6">
                   <input name="financialNeed" type="checkbox" checked={profile.financialNeed} onChange={handleProfileChange} className="accent-[#D1FF26] w-5 h-5 bg-[#0A0A0B] border-[#242427]" />
                   <span className="text-[#7C7C7C] uppercase tracking-wider text-[11px]">Financial Need (Scholarship Bias)</span>
                 </label>
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[#7C7C7C] uppercase tracking-wider text-[11px]">Skills / Interests</label>
                <div className="flex flex-wrap gap-2 pt-2">
                  {INTEREST_OPTIONS.map(opt => (
                     <button
                       key={opt}
                       type="button"
                       onClick={() => {
                          setProfile(prev => ({
                             ...prev,
                             skillsInterests: prev.skillsInterests.includes(opt)
                                ? prev.skillsInterests.filter(i => i !== opt)
                                : [...prev.skillsInterests, opt]
                          }));
                       }}
                       className={`px-4 py-2 text-[12px] transition-colors border cursor-pointer font-sans whitespace-nowrap ${
                         profile.skillsInterests.includes(opt) 
                           ? 'bg-[#D1FF26] text-black border-[#D1FF26] font-semibold' 
                           : 'bg-transparent text-[#7C7C7C] border-[#242427] hover:border-[#7C7C7C]'
                       }`}
                     >
                       {opt}
                     </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 md:col-span-2">
                <label className="text-[#7C7C7C] uppercase tracking-wider text-[11px]">Preferred Opportunities</label>
                <div className="flex flex-wrap gap-2 pt-2">
                  {PREFERRED_OPTIONS.map(opt => (
                     <button
                       key={opt}
                       type="button"
                       onClick={() => {
                          setProfile(prev => ({
                             ...prev,
                             preferredTypes: prev.preferredTypes.includes(opt)
                                ? prev.preferredTypes.filter(i => i !== opt)
                                : [...prev.preferredTypes, opt]
                          }));
                       }}
                       className={`px-4 py-2 text-[12px] transition-colors border cursor-pointer font-sans whitespace-nowrap ${
                         profile.preferredTypes.includes(opt) 
                           ? 'bg-[#D1FF26] text-black border-[#D1FF26] font-semibold' 
                           : 'bg-transparent text-[#7C7C7C] border-[#242427] hover:border-[#7C7C7C]'
                       }`}
                     >
                       {opt}
                     </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[#7C7C7C] uppercase tracking-wider text-[11px]">Location Preference</label>
                <select name="locationPreference" value={profile.locationPreference} onChange={handleProfileChange} className="bg-[#0A0A0B] border border-[#242427] p-3 focus:outline-none focus:border-[#D1FF26] transition-colors text-[#d4d4d4] cursor-pointer w-full">
                  {LOCATION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-[#7C7C7C] uppercase tracking-wider text-[11px]">Experience Level</label>
                <select name="pastExperience" value={profile.pastExperience} onChange={handleProfileChange} className="bg-[#0A0A0B] border border-[#242427] p-3 focus:outline-none focus:border-[#D1FF26] transition-colors text-[#d4d4d4] cursor-pointer w-full">
                  {EXPERIENCE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 mt-8 flex items-center gap-3 text-[12px]">
                <AlertTriangle size={18} /> {errorMsg}
              </div>
            )}

            <button 
              onClick={handleProcessInboxBatch}
              disabled={loading || inboxEmails.length === 0}
              className="mt-8 self-center bg-[#D1FF26] text-black px-[40px] py-[16px] font-[800] uppercase tracking-wider border-none text-[15px] hover:bg-white hover:text-black transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-3 w-full justify-center"
            >
              {loading ? (
                <><Loader2 size={20} className="animate-spin" /> EXECUTING [{loadingProgress}%]...</>
              ) : (
                <><Terminal size={20} /> INITIALIZE BATCH TRIAGE</>
              )}
            </button>
          </div>
        </section>

        {/* Right Column: Output Results */}
        <section className="bg-[#0A0A0B] p-6 md:p-[40px] flex flex-col gap-10 overflow-y-auto custom-scrollbar h-full lg:max-h-[calc(100vh-200px)] border-l border-[#242427]">
          {loading && (
            <div className="flex flex-col items-center justify-center h-full text-[#7C7C7C] font-mono gap-4 animate-in fade-in duration-500 min-h-[400px]">
              <Loader2 size={32} className="animate-spin text-[#D1FF26]" />
              <div className="text-[14px] uppercase tracking-widest text-[#D1FF26] font-bold mt-2">Compiling Best Opportunities...</div>
              
              <div className="w-full max-w-[350px] h-[4px] bg-[#242427] mt-4 overflow-hidden relative rounded-full">
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-[#D1FF26] transition-all duration-300 ease-out"
                  style={{ width: `${loadingProgress}%` }}
                ></div>
              </div>
              
              <div className="text-[11px] tracking-wider mt-2">{loadingProgress}% COMPLETE</div>
            </div>
          )}

          {/* Section 3: Ranked Output Results */}
          {!loading && rankedResults !== null && (
             <div className="flex flex-col gap-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-[100px]">
               
               {/* ACCEPTED OPPORTUNITIES */}
               <div className="bg-[#141416] border border-[#D1FF26] p-6 lg:p-[40px] font-mono flex flex-col">
                 <div className="flex items-center justify-between gap-3 mb-8 border-b border-[#242427] pb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 flex items-center justify-center text-black bg-[#D1FF26]">
                      <ListOrdered size={24} />
                    </div>
                    <div>
                      <h2 className="font-sans text-[24px] font-bold tracking-tight text-white m-0 uppercase">Priority Queue</h2>
                      <div className="text-[12px] text-[#7C7C7C] tracking-widest uppercase mt-1">Found {rankedResults.accepted.length} validated opportunities from {inboxEmails.length} emails.</div>
                    </div>
                  </div>
                </div>

                {rankedResults.accepted.length === 0 ? (
                   <div className="text-center py-10 text-[#7C7C7C] font-sans text-lg">
                      No exact matches detected matching your strict profile constraints.
                   </div>
                ) : (
                   <div className="flex flex-col gap-6">
                     {rankedResults.accepted.map((res, idx) => (
                     <div key={idx} className="bg-[#0A0A0B] border border-[#242427] flex flex-col relative overflow-hidden group hover:border-[#D1FF26] transition-colors">
                        
                        {/* Mobile/Edge rank stripe */}
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#242427] group-hover:bg-[#D1FF26] transition-colors"></div>

                        <div className="flex items-start md:items-center justify-between p-5 border-b border-[#242427] bg-[#101012] pl-6">
                          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                            <div className="text-[32px] font-black text-[#D1FF26] leading-none">#{idx + 1}</div>
                            <div className="flex flex-col gap-1">
                              <h3 className="font-sans text-[18px] md:text-[20px] font-bold text-white uppercase tracking-tight m-0">{res.opp.title || "Unnamed Opportunity"}</h3>
                              <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#7C7C7C] tracking-wider uppercase font-bold">
                                {res.opp.type && <span className="bg-[#242427] text-white px-2 py-0.5 rounded">{res.opp.type}</span>}
                                {res.opp.organization && <span>{res.opp.organization}</span>}
                                <span>SCORE: <span className="text-[#D1FF26]">{res.score} PTS</span></span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 pl-8">
                           {/* Reasons List */}
                           <div>
                              <div className="text-[12px] uppercase text-[#7c7c7c] tracking-widest mb-4 border-b border-[#242427] pb-2 font-bold flex items-center gap-2">
                                <Target size={14}/> Profile Validation
                              </div>
                              <ul className="list-none p-0 m-0 space-y-3">
                                {res.reasons.map((r: string, i: number) => (
                                  <li key={i} className="text-[#d4d4d4] text-[13px] flex items-start leading-relaxed">
                                    <span className="text-[#D1FF26] mr-3 mt-1.5 block h-2 w-2 bg-[#D1FF26] shrink-0"></span> {r}
                                  </li>
                                ))}
                              </ul>
                           </div>

                           {/* Tasks List */}
                           <div>
                              <div className="text-[12px] uppercase text-[#7c7c7c] tracking-widest mb-4 border-b border-[#242427] pb-2 font-bold flex items-center gap-2">
                                <CheckSquare size={14}/> Action Checklist
                              </div>
                              <ul className="list-none p-0 m-0 space-y-4">
                                {buildActionChecklist(res.opp).map((step: string, i: number) => (
                                  <li key={i} className="text-[#d4d4d4] text-[13px] flex items-start bg-[#101012] p-3 border border-[#242427]">
                                    <div className="mr-3 font-bold text-[#7c7c7c] shrink-0 whitespace-nowrap">Step {i+1}.</div>
                                    <div className="leading-relaxed">{step}</div>
                                  </li>
                                ))}
                              </ul>
                           </div>
                        </div>

                     </div>
                   ))}
                 </div>
              )}
             </div>

             {/* IGNORED / FILTERED EMAILS */}
             <div className="bg-[#101012] border border-[#ff3b30]/30 p-6 lg:p-[40px] font-mono flex flex-col mt-4 opacity-80 transition-opacity hover:opacity-100">
               <div className="flex items-center justify-between gap-3 mb-8 border-b border-[#242427] pb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center text-[#ff3b30] bg-[#ff3b30]/10 border border-[#ff3b30]/30">
                    <Trash2 size={24} />
                  </div>
                  <div>
                    <h2 className="font-sans text-[24px] font-bold tracking-tight text-white m-0 uppercase">Discarded / Spammed</h2>
                    <div className="text-[12px] text-[#7C7C7C] tracking-widest uppercase mt-1">Found {rankedResults.ignored.length} noise/spam emails or strict mismatched opportunities.</div>
                  </div>
                </div>
              </div>

              {rankedResults.ignored.length === 0 ? (
                 <div className="text-center py-10 text-[#7C7C7C] font-sans text-[13px]">
                    No noise or ignored emails were captured. Everything matched perfectly.
                 </div>
              ) : (
                 <div className="flex flex-col gap-4">
                   {rankedResults.ignored.map((res, idx) => (
                     <div key={idx} className="bg-[#0A0A0B] border border-[#242427] flex flex-col p-5 pl-6 relative">
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#ff3b30]/50"></div>
                        <div className="flex flex-col gap-2">
                           <h3 className="font-sans text-[16px] font-bold text-[#b4b4b4] uppercase tracking-tight m-0 line-through">
                             {res.opp.title ? res.opp.title : "Unidentifiable Mail"}
                           </h3>
                           <div className="text-[#ff3b30] text-[11px] uppercase tracking-widest mt-1 font-bold">
                             Drop Reason: {res.reasons[0]}
                           </div>
                        </div>
                     </div>
                   ))}
                 </div>
              )}
             </div>

             </div>
          )}
        </section>
      </main>

      <footer className="shrink-0 h-auto md:h-[60px] py-4 md:py-0 border-t border-[#242427] flex flex-col md:flex-row flex-wrap items-center px-6 md:px-[60px] justify-between gap-4 text-[11px] uppercase tracking-[1px] text-[#7C7C7C] bg-[#0A0A0B]">
        <div>Path: /workspace/engine_batch.tsx</div>
        <div className="hidden lg:block">System Memory: 54% Available</div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#D1FF26] animate-pulse"></span> FULL BATCH SYSTEM ONLINE
        </div>
      </footer>
    </div>
  );
}
