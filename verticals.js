/* Renue Home — vertical funnel content. Easy questions first, contact last. Edit freely. */
(function(){
  var LICENSE = "Where applicable, we aim to connect homeowners with professionals who meet relevant local requirements. Homeowners should verify licensing, insurance, and credentials before hiring.";
  var GENERAL = [
    {q:"Is Renue Home free to use?", a:"Yes. Renue Home is free for homeowners. There is no cost or obligation to request and compare quotes."},
    {q:"Am I required to hire anyone?", a:"No. There is no obligation. You can compare your options and decide what works for you, or do nothing at all."},
    {q:"How quickly will I hear back?", a:"It varies by area and project, but many homeowners are contacted by a local professional shortly after submitting their request."},
    {q:"Are the pros licensed and insured?", a:LICENSE}
  ];
  var TIMELINE = {id:"timeline", type:"single", q:"When are you looking to start?", options:["As soon as possible","Within 1–3 months","3–6 months","Just researching"]};
  var OWNER = {id:"owner", type:"single", q:"Are you the homeowner?", options:["Yes, I own the home","No, I rent"]};
  var CONTACT = {id:"contact", type:"contact", q:"Where should we send your matches?", sub:"Your information is secure & confidential."};
  function zip(t){ return {id:"zip", type:"zip", q:t||"Where would this project take place?", sub:"Enter your ZIP code & we will match you with local pros."}; }

  window.RENUE_VERTICALS = {
    windows:{
      name:"Windows", word:"window", title:"Window Replacement Quotes — Renue Home",
      headline:"Compare quotes for new windows in your area",
      sub:"Answer a few quick questions to see your local window replacement options — free and no obligation.",
      benefitsHead:"A smarter way to shop for replacement windows",
      steps:[
        zip("Where would this window project take place?"),
        {id:"qty", type:"single", q:"How many windows are involved?", options:["1 window","2–3 windows","4–6 windows","7–9 windows","10+ windows"]},
        {id:"nature", type:"single", q:"Is this a repair or replacement?", options:["Replace existing windows","Install new windows","Repair existing windows","Not sure yet"]},
        TIMELINE, OWNER, CONTACT
      ],
      faqs:[
        {q:"How much do replacement windows cost?", a:"Costs vary widely by window type, size, material, and how many you replace. Comparing local quotes is the best way to see real pricing for your project."},
        {q:"Repair or full replacement — which do I need?", a:"It depends on the age and condition of your windows. A local pro can assess and recommend the most cost-effective option."}
      ].concat(GENERAL)
    },
    bathroom:{
      name:"Bathroom", word:"bathroom", title:"Bathroom Remodel Quotes — Renue Home",
      headline:"Thinking about a bathroom upgrade?",
      sub:"Compare local remodel options — including walk-in showers, tub-to-shower conversions, and safety features.",
      benefitsHead:"Compare bathroom remodel options with confidence",
      steps:[
        {id:"project", type:"single", q:"What type of bathroom project are you considering?", options:["Tub-to-shower conversion","Walk-in shower","Full bathroom remodel","Safety / mobility upgrade","Not sure yet"]},
        zip("Where is the project located?"),
        {id:"features", type:"multi", q:"Any features you’re interested in?", sub:"Select all that apply — or skip.", options:["Low-step entry","Grab bars","Anti-slip flooring","Walk-in tub","Full remodel"]},
        {id:"financing", type:"single", q:"Are you interested in financing options?", options:["Yes","No","Not sure"]},
        TIMELINE, OWNER, CONTACT
      ],
      faqs:[
        {q:"How long does a bathroom remodel take?", a:"It depends on scope. Some tub-to-shower conversions can be completed quickly, while full remodels take longer. A local pro can give you a timeline."},
        {q:"Do you offer walk-in tubs and safety upgrades?", a:"We can match you with local professionals who offer accessibility and safety options like low-step entry, grab bars, and anti-slip flooring."}
      ].concat(GENERAL)
    },
    roofing:{
      name:"Roofing", word:"roofing", title:"Roofing Quotes — Repair & Replacement — Renue Home",
      headline:"Need help with a roof repair or replacement?",
      sub:"Get matched with local roofing pros for a free, no-obligation quote.",
      benefitsHead:"Compare roofing options the easy way",
      steps:[
        {id:"project", type:"single", q:"What type of roofing help do you need?", options:["Roof replacement","Roof repair","Storm damage","New roof installation","Not sure yet"]},
        zip("Where is the roofing project located?"),
        {id:"age", type:"single", q:"Approximately how old is your roof?", options:["0–5 years","6–10 years","11–20 years","20+ years","Not sure"]},
        {id:"damage", type:"single", q:"Any leaks or storm damage?", options:["Yes — active leak","Yes — storm damage","No","Not sure"]},
        TIMELINE, OWNER, CONTACT
      ],
      faqs:[
        {q:"Does insurance cover roof storm damage?", a:"It can, depending on your policy and the cause of damage. A local roofing pro can help you understand your options and document the damage."},
        {q:"How do I know if I need a repair or a full replacement?", a:"Roof age, extent of damage, and leaks all factor in. A professional inspection is the best way to decide."}
      ].concat(GENERAL)
    },
    hvac:{
      name:"HVAC", word:"HVAC", title:"HVAC Quotes — Heating & Cooling — Renue Home",
      headline:"Need heating or cooling help?",
      sub:"Compare options from local HVAC professionals — repairs, replacements, and new installs.",
      benefitsHead:"Find the right HVAC pro, faster",
      steps:[
        {id:"system", type:"single", q:"What do you need help with?", options:["Air conditioning","Heating","Both heating & cooling","Not sure"]},
        zip("Where do you need HVAC service?"),
        {id:"nature", type:"single", q:"Is this a repair or replacement?", options:["Repair","Replacement","New installation","Not sure yet"]},
        {id:"working", type:"single", q:"Is the system currently working?", options:["Yes","No","Sometimes / intermittent"]},
        {id:"soon", type:"single", q:"How soon do you need service?", options:["Emergency / ASAP","This week","This month","Just researching"]},
        OWNER, CONTACT
      ],
      faqs:[
        {q:"How much does a new HVAC system cost?", a:"It depends on system size, efficiency, and your home. Comparing local quotes helps you understand fair pricing for your situation."},
        {q:"Do you handle emergency HVAC issues?", a:"Tell us your timeframe and we will try to match you with local pros who can help on your schedule, including urgent needs."}
      ].concat(GENERAL)
    },
    kitchen:{
      name:"Kitchen", word:"kitchen", title:"Kitchen Remodel Quotes — Renue Home",
      headline:"Planning a kitchen remodel?",
      sub:"Compare local options for full remodels, cabinets, countertops, and refreshes — free and no obligation.",
      benefitsHead:"Compare kitchen remodel options with confidence",
      steps:[
        {id:"project", type:"single", q:"What kind of kitchen project?", options:["Full remodel","Cabinets","Countertops","Refresh / update","Not sure yet"]},
        zip("Where is the kitchen project located?"),
        {id:"financing", type:"single", q:"Are you interested in financing options?", options:["Yes","No","Not sure"]},
        TIMELINE, OWNER, CONTACT
      ],
      faqs:[
        {q:"How much does a kitchen remodel cost?", a:"Kitchen costs range widely based on size, materials, and scope. Comparing local quotes is the best way to estimate your project."},
        {q:"Can I just update cabinets or countertops?", a:"Absolutely. Many homeowners start with a single update. Tell us what you have in mind and we will match you accordingly."}
      ].concat(GENERAL)
    },
    flooring:{
      name:"Flooring", word:"flooring", title:"Flooring Quotes — Renue Home",
      headline:"Comparing new flooring options?",
      sub:"Get matched with local flooring pros for hardwood, vinyl, tile, carpet, and more.",
      benefitsHead:"Shop flooring options the smart way",
      steps:[
        {id:"type", type:"single", q:"What type of flooring are you considering?", options:["Hardwood","Laminate / Vinyl","Tile","Carpet","Not sure yet"]},
        zip("Where is the flooring project located?"),
        {id:"area", type:"single", q:"About how much area?", options:["1 room","2–3 rooms","Whole home","Not sure"]},
        TIMELINE, OWNER, CONTACT
      ],
      faqs:[
        {q:"Which flooring is best for my home?", a:"It depends on your budget, lifestyle, and rooms involved. A local pro can recommend options that fit your needs."},
        {q:"Do quotes include installation?", a:"Many local professionals quote materials and installation together. You can confirm details directly with the pros you are matched with."}
      ].concat(GENERAL)
    },
    solar:{
      name:"Solar", word:"solar", title:"Solar Quotes — Renue Home",
      headline:"Curious if solar makes sense for your home?",
      sub:"Compare local solar options and see what may be available in your area — free and no obligation.",
      benefitsHead:"Compare solar options without the pressure",
      steps:[
        {id:"goal", type:"single", q:"What’s your main goal with solar?", options:["Lower energy bills","Backup power","Go green","Not sure yet"]},
        zip("Where is the home located?"),
        {id:"bill", type:"single", q:"Roughly what’s your average monthly electric bill?", options:["Under $100","$100–$200","$200–$400","$400+","Not sure"]},
        {id:"roof", type:"single", q:"What’s the condition of your roof?", options:["Newer","Average","Older","Not sure"]},
        OWNER, CONTACT
      ],
      faqs:[
        {q:"Are there incentives or rebates for solar?", a:"Incentives vary by location and over time, and are not available to everyone. A local pro can explain what may apply to your situation."},
        {q:"Will solar work on my roof?", a:"Roof age, orientation, and shading all matter. A local professional can assess your home and your options."}
      ].concat(GENERAL)
    },
    gutters:{
      name:"Gutters", word:"gutter", title:"Gutter & Gutter Guard Quotes — Renue Home",
      headline:"Need new gutters or gutter protection?",
      sub:"Compare local options for new gutters, gutter guards, repairs, and replacements.",
      benefitsHead:"Protect your home with the right gutter pro",
      steps:[
        {id:"project", type:"single", q:"What gutter help do you need?", options:["New gutters","Gutter guards / protection","Repair","Replacement","Not sure yet"]},
        zip("Where is the project located?"),
        {id:"stories", type:"single", q:"How many stories is your home?", options:["Single-story","Two-story","Three or more"]},
        TIMELINE, OWNER, CONTACT
      ],
      faqs:[
        {q:"Are gutter guards worth it?", a:"They can reduce cleaning and clogs for many homes. A local pro can recommend a solution for your roofline and tree coverage."},
        {q:"Can you repair just a section of gutter?", a:"Often, yes. Tell us what you are seeing and we will match you with pros who handle repairs and replacements."}
      ].concat(GENERAL)
    },
    painting:{
      name:"Painting", word:"painting", title:"Painting Quotes — Interior & Exterior — Renue Home",
      headline:"Refresh your home with a new coat of paint",
      sub:"Compare local options for interior and exterior painting — free, no-obligation quotes.",
      benefitsHead:"Compare painting options the easy way",
      steps:[
        {id:"project", type:"single", q:"What painting project do you have in mind?", options:["Interior painting","Exterior painting","Both interior & exterior","Cabinet refinishing","Not sure yet"]},
        zip("Where is the painting project located?"),
        {id:"size", type:"single", q:"About how large is the project?", options:["1–2 rooms","Several rooms","Whole interior","Whole exterior","Not sure"]},
        TIMELINE, OWNER, CONTACT
      ],
      faqs:[
        {q:"How much does painting cost?", a:"It depends on square footage, surfaces, and prep work. Comparing local quotes is the best way to see real pricing."},
        {q:"Interior, exterior, or both?", a:"Tell us what you need and we will match you with pros who handle your type of project."}
      ].concat(GENERAL)
    },
    other:{
      name:"Home Projects", word:"home", title:"Get Matched With Local Home Pros — Renue Home",
      headline:"Tell us about your home project",
      sub:"Not sure which category fits? Start here and we’ll match you with the right local professionals.",
      benefitsHead:"One simple way to start any home project",
      steps:[
        {id:"project", type:"single", q:"What type of project do you need help with?", options:["Bathroom","Kitchen","Windows","Roofing","HVAC","Flooring","Solar","Gutters","Painting","Something else"]},
        zip("Where would this project take place?"),
        TIMELINE, OWNER, CONTACT
      ],
      faqs:[].concat(GENERAL)
    }
  };
})();
