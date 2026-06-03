/* Renue Home — vertical funnel content. Easy questions first, contact last. Edit freely.
   Each vertical: name, word, title, headline, sub, benefitsHead, steps[], faqs[],
   seo{label,heading,lead[],factors[],types[]}, gallery[] (captions). */
(function(){
  var LICENSE = "Where applicable, we aim to connect homeowners with professionals who meet relevant local requirements. Homeowners should verify licensing, insurance, and credentials before hiring.";
  var GENERAL = [
    {q:"Is Renue Home free to use?", a:"Yes. Renue Home is free for homeowners. There is no cost or obligation to request and compare quotes."},
    {q:"Am I required to hire anyone?", a:"No. There is no obligation. You can compare your options and decide what works for you, or do nothing at all."},
    {q:"How quickly will I hear back?", a:"It varies by area and project, but many homeowners are contacted by a local professional shortly after submitting their request."},
    {q:"Are the pros licensed and insured?", a:LICENSE}
  ];
  // Tighter first question = single low-commitment tap. Contact is always last.
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
        {id:"nature", type:"single", q:"What kind of window project is this?", options:["Replace existing windows","Install new windows","Repair existing windows","Not sure yet"]},
        {id:"qty", type:"single", q:"How many windows are involved?", options:["1 window","2–3 windows","4–6 windows","7–9 windows","10+ windows"]},
        zip("Where would this window project take place?"),
        TIMELINE, OWNER, CONTACT
      ],
      faqs:[
        {q:"How much do replacement windows cost?", a:"Costs vary widely by window type, size, material, and how many you replace. Comparing local quotes is the best way to see real pricing for your project."},
        {q:"Repair or full replacement — which do I need?", a:"It depends on the age and condition of your windows. A local pro can assess and recommend the most cost-effective option."}
      ].concat(GENERAL),
      seo:{
        label:"Window replacement guide", heading:"Replacement windows: what to know before you buy",
        lead:[
          "Replacing old windows is one of the highest-impact upgrades a homeowner can make. New energy-efficient windows can cut drafts, reduce outside noise, lower heating and cooling bills, and refresh the look of your home inside and out. The right choice depends on your climate, your home's style, and how long you plan to stay.",
          "Because prices in {area} vary by frame material, glass package, and installer, the smartest move is to compare a few local quotes side by side. Renue Home makes that quick — answer a few questions and we'll match you with vetted pros who serve your area, with no obligation to hire."
        ],
        factors:[
          {h:"Number & size of windows", p:"The biggest driver of total cost. Whole-home projects cost more up front but often unlock per-window savings."},
          {h:"Frame material", p:"Vinyl is the most budget-friendly; fiberglass and wood-clad cost more but offer different looks and performance."},
          {h:"Glass package", p:"Double- vs triple-pane, low-E coatings, and gas fills affect both price and energy savings."},
          {h:"Installation complexity", p:"Full-frame replacements, custom shapes, and upper-story access can raise labor costs."}
        ],
        types:[
          {h:"Double-hung", p:"The most popular style — both sashes open, easy to clean."},
          {h:"Casement", p:"Crank-out windows that seal tightly and maximize airflow."},
          {h:"Sliding & picture", p:"Great for wide openings and unobstructed views."},
          {h:"Bay & bow", p:"Add space and architectural character to a room."}
        ]
      },
      gallery:["Energy-efficient double-hung windows","Black-frame modern picture window","Bay window living-room upgrade","Whole-home vinyl replacement","Casement kitchen windows","Before & after curb appeal"]
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
      ].concat(GENERAL),
      seo:{
        label:"Bathroom remodel guide", heading:"Bathroom remodeling: options, costs & timelines",
        lead:[
          "A bathroom remodel can range from a fast, one-to-two-day tub-to-shower conversion to a full gut renovation with new layout, tile, vanity, and fixtures. Knowing which type of project fits your needs — and your budget — is the first step to getting accurate quotes.",
          "Local pricing in {area} depends on materials, the size of the space, and how much plumbing changes. Comparing a few vetted local quotes through Renue Home helps you see realistic numbers and timelines before you commit — with zero obligation."
        ],
        factors:[
          {h:"Scope of work", p:"A surface refresh costs far less than a full remodel that moves plumbing or changes the layout."},
          {h:"Materials & fixtures", p:"Tile, vanities, glass, and fixtures span a wide price range and drive much of the budget."},
          {h:"Accessibility features", p:"Walk-in tubs, low-step entries, and grab bars add cost but improve safety and resale appeal."},
          {h:"Labor & permits", p:"Skilled labor and any required permits factor into the total, especially for plumbing changes."}
        ],
        types:[
          {h:"Tub-to-shower conversion", p:"Swap an unused tub for a modern, easy-access shower — often a quick project."},
          {h:"Walk-in shower", p:"Sleek, low-maintenance, and great for accessibility."},
          {h:"Full remodel", p:"New layout, tile, vanity, lighting, and fixtures from the studs out."},
          {h:"Safety & mobility upgrade", p:"Walk-in tubs, grab bars, and anti-slip flooring for aging in place."}
        ]
      },
      gallery:["Modern walk-in glass shower","Tub-to-shower conversion","Spa-style full remodel","Double-vanity upgrade","Accessible low-step entry","Subway-tile shower surround"]
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
      ].concat(GENERAL),
      seo:{
        label:"Roofing guide", heading:"Roof repair vs. replacement: how to decide",
        lead:[
          "Your roof protects everything under it, so small problems are worth addressing quickly. Whether you're dealing with a leak, storm damage, or simply an aging roof near the end of its life, the right answer ranges from a targeted repair to a full replacement.",
          "Roofing costs in {area} depend on the size and pitch of your roof, the material you choose, and the condition of what's underneath. Renue Home connects you with local roofing pros so you can compare free quotes and, if applicable, get help documenting storm or hail damage for insurance."
        ],
        factors:[
          {h:"Roof size & pitch", p:"Larger and steeper roofs take more material and labor."},
          {h:"Material", p:"Asphalt shingles are most common; metal, tile, and slate cost more and last longer."},
          {h:"Damage & tear-off", p:"Removing old layers and repairing decking adds to the job."},
          {h:"Storm/insurance work", p:"Documented storm or hail damage may be covered by your policy."}
        ],
        types:[
          {h:"Asphalt shingle", p:"Affordable, widely available, and easy to repair."},
          {h:"Metal roofing", p:"Long-lasting and energy-efficient, with a higher up-front cost."},
          {h:"Tile & slate", p:"Premium durability and distinctive looks."},
          {h:"Flat / low-slope", p:"Common on additions and modern homes; uses specialized membranes."}
        ]
      },
      gallery:["New architectural shingle roof","Standing-seam metal roof","Storm-damage repair","Full tear-off & replacement","Clay tile roofing","Roof inspection & estimate"]
    },

    hvac:{
      name:"HVAC", word:"HVAC", title:"HVAC Quotes — Heating & Cooling — Renue Home",
      headline:"Need heating or cooling help?",
      sub:"Compare options from local HVAC professionals — repairs, replacements, and new installs.",
      benefitsHead:"Find the right HVAC pro, faster",
      steps:[
        {id:"system", type:"single", q:"What do you need help with?", options:["Air conditioning","Heating","Both heating & cooling","Not sure"]},
        {id:"nature", type:"single", q:"Is this a repair or replacement?", options:["Repair","Replacement","New installation","Not sure yet"]},
        zip("Where do you need HVAC service?"),
        {id:"working", type:"single", q:"Is the system currently working?", options:["Yes","No","Sometimes / intermittent"]},
        {id:"soon", type:"single", q:"How soon do you need service?", options:["Emergency / ASAP","This week","This month","Just researching"]},
        OWNER, CONTACT
      ],
      faqs:[
        {q:"How much does a new HVAC system cost?", a:"It depends on system size, efficiency, and your home. Comparing local quotes helps you understand fair pricing for your situation."},
        {q:"Do you handle emergency HVAC issues?", a:"Tell us your timeframe and we will try to match you with local pros who can help on your schedule, including urgent needs."}
      ].concat(GENERAL),
      seo:{
        label:"Heating & cooling guide", heading:"HVAC repair, replacement & new installs",
        lead:[
          "When your heating or cooling system struggles, comfort and energy bills both take a hit. Sometimes a repair is all you need; other times, an aging or failing system is more cost-effective to replace with a modern, high-efficiency unit.",
          "HVAC pricing in {area} depends on system type, size, efficiency rating, and your home's existing ductwork. Renue Home matches you with local heating and cooling pros so you can compare quotes — and find someone who can help fast when it's urgent."
        ],
        factors:[
          {h:"System type & size", p:"Central AC, heat pumps, and furnaces are sized to your home's square footage."},
          {h:"Efficiency rating", p:"Higher SEER/AFUE units cost more up front but lower running costs."},
          {h:"Ductwork & install", p:"Existing duct condition and install complexity affect labor."},
          {h:"Urgency", p:"Emergency service and peak-season demand can influence pricing."}
        ],
        types:[
          {h:"Central air conditioning", p:"Whole-home cooling through your existing ducts."},
          {h:"Heat pump", p:"Efficient heating and cooling in one system."},
          {h:"Furnace", p:"Gas or electric heating for cold climates."},
          {h:"Ductless mini-split", p:"Zoned comfort without ductwork."}
        ]
      },
      gallery:["New central AC condenser","High-efficiency furnace install","Ductless mini-split","Heat pump replacement","Thermostat & system tune-up","Emergency HVAC repair"]
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
      ].concat(GENERAL),
      seo:{
        label:"Kitchen remodel guide", heading:"Kitchen remodeling: from refresh to full renovation",
        lead:[
          "The kitchen is the heart of most homes and one of the best investments for daily enjoyment and resale value. Projects range from a budget-friendly cabinet-and-counter refresh to a full layout change with new cabinetry, appliances, and lighting.",
          "Because kitchen costs in {area} swing widely with materials and scope, comparing a few local quotes is the clearest way to plan your budget. Renue Home connects you with vetted local remodelers — free, with no obligation."
        ],
        factors:[
          {h:"Scope & layout", p:"Keeping the existing layout saves money; moving plumbing or walls adds cost."},
          {h:"Cabinets & countertops", p:"Often the largest line items — material choice matters a lot."},
          {h:"Appliances", p:"Built-in and high-end appliances raise the budget."},
          {h:"Finishes & lighting", p:"Backsplash, flooring, and lighting round out the project."}
        ],
        types:[
          {h:"Full remodel", p:"New cabinets, counters, appliances, and layout."},
          {h:"Cabinet refacing/replacement", p:"A big visual change for less than a full remodel."},
          {h:"Countertop upgrade", p:"Quartz, granite, or solid surface for a fresh look."},
          {h:"Refresh", p:"Paint, hardware, backsplash, and lighting updates."}
        ]
      },
      gallery:["Open-concept kitchen remodel","Quartz island & counters","Shaker cabinet refacing","Modern backsplash & lighting","Custom pantry storage","Before & after kitchen"]
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
      ].concat(GENERAL),
      seo:{
        label:"Flooring guide", heading:"Choosing new flooring: materials & costs",
        lead:[
          "New flooring transforms how a home looks and feels. The best material depends on the room, your lifestyle, pets and kids, moisture levels, and budget — from warm hardwood to durable luxury vinyl, classic tile, or cozy carpet.",
          "Flooring costs in {area} depend on material, square footage, subfloor prep, and installation. Renue Home matches you with local flooring pros so you can compare material-and-install quotes side by side, free and with no obligation."
        ],
        factors:[
          {h:"Material", p:"Hardwood, luxury vinyl, tile, and carpet each carry different price points."},
          {h:"Square footage", p:"Total area is the main driver of both material and labor."},
          {h:"Subfloor prep", p:"Leveling, moisture barriers, and old-floor removal add cost."},
          {h:"Installation", p:"Patterns, stairs, and transitions affect labor time."}
        ],
        types:[
          {h:"Hardwood", p:"Timeless and refinishable; great resale value."},
          {h:"Luxury vinyl (LVP)", p:"Waterproof, durable, and budget-friendly."},
          {h:"Tile", p:"Ideal for kitchens, baths, and high-moisture areas."},
          {h:"Carpet", p:"Soft and warm for bedrooms and living spaces."}
        ]
      },
      gallery:["Wide-plank hardwood install","Luxury vinyl plank floors","Porcelain tile kitchen","Plush bedroom carpet","Whole-home flooring refresh","Stair & landing detail"]
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
      ].concat(GENERAL),
      seo:{
        label:"Home solar guide", heading:"Is home solar right for you?",
        lead:[
          "Home solar can reduce or offset your electric bill and, with battery storage, provide backup power during outages. Whether it pencils out depends on your electricity usage, your roof, local sunlight, and the incentives available where you live.",
          "Solar pricing and incentives in {area} vary, and savings aren't the same for every home. Renue Home connects you with local solar pros so you can get a real assessment and compare options — free, with no pressure to buy."
        ],
        factors:[
          {h:"System size", p:"Sized to your electricity usage and roof space."},
          {h:"Roof & shading", p:"Orientation, pitch, age, and shade affect production."},
          {h:"Battery storage", p:"Optional backup power adds cost and resilience."},
          {h:"Incentives", p:"Federal, state, and utility incentives change over time and by location."}
        ],
        types:[
          {h:"Grid-tied solar", p:"Offsets your bill; most common and lowest cost."},
          {h:"Solar + battery", p:"Adds backup power during outages."},
          {h:"Whole-home electrification", p:"Pairs solar with efficient electric systems."}
        ]
      },
      gallery:["Rooftop solar array","Solar + home battery","Ground-mount system","Energy-monitoring app","Modern panel install","Site assessment & quote"]
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
      ].concat(GENERAL),
      seo:{
        label:"Gutter guide", heading:"Gutters & gutter guards: protecting your home",
        lead:[
          "Gutters quietly do critical work — channeling water away from your roof, siding, and foundation. Failing or undersized gutters can lead to leaks, erosion, and costly water damage, while gutter guards cut down on cleaning and clogs.",
          "Gutter pricing in {area} depends on the linear footage, material, your home's height, and whether you add protection. Renue Home connects you with local gutter pros so you can compare quotes for new gutters, guards, or repairs."
        ],
        factors:[
          {h:"Linear footage", p:"Total length of gutter needed is the main cost driver."},
          {h:"Material", p:"Aluminum, steel, and copper differ in price and longevity."},
          {h:"Home height", p:"Two- and three-story homes require more setup and labor."},
          {h:"Guards & add-ons", p:"Gutter protection systems add cost but reduce maintenance."}
        ],
        types:[
          {h:"Seamless gutters", p:"Custom-formed on site to reduce leaks."},
          {h:"Gutter guards", p:"Keep out leaves and debris; less cleaning."},
          {h:"Repairs", p:"Re-seal, re-pitch, or replace damaged sections."},
          {h:"Downspout work", p:"Improve drainage away from the foundation."}
        ]
      },
      gallery:["Seamless aluminum gutters","Mesh gutter guard system","Two-story gutter install","Downspout & drainage","Copper gutter upgrade","Gutter repair & re-seal"]
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
      ].concat(GENERAL),
      seo:{
        label:"Painting guide", heading:"Interior & exterior painting: what to expect",
        lead:[
          "A fresh coat of paint is one of the most cost-effective ways to transform a home — inside or out. Beyond looks, exterior paint also protects siding and trim from the elements, while quality interior work makes rooms feel new.",
          "Painting costs in {area} depend on square footage, the number of colors, surface condition, and prep work. Renue Home matches you with local painters so you can compare detailed quotes, free and with no obligation."
        ],
        factors:[
          {h:"Area & coats", p:"Square footage and the number of coats drive material and labor."},
          {h:"Prep work", p:"Patching, sanding, and priming damaged surfaces adds time."},
          {h:"Surfaces", p:"Trim, ceilings, cabinets, and textured walls vary in difficulty."},
          {h:"Paint quality", p:"Premium paints cost more but last longer and cover better."}
        ],
        types:[
          {h:"Interior painting", p:"Walls, ceilings, trim, and doors."},
          {h:"Exterior painting", p:"Siding, trim, and protection from weather."},
          {h:"Cabinet refinishing", p:"Update kitchen or bath cabinets without replacing them."},
          {h:"Accent & specialty", p:"Accent walls, textures, and detailed finishes."}
        ]
      },
      gallery:["Freshly painted interior","Exterior repaint & trim","Cabinet refinishing","Accent wall feature","Whole-home color refresh","Prep & priming work"]
    },

    siding:{
      name:"Siding", word:"siding", title:"Siding Quotes — Replacement & Repair — Renue Home",
      headline:"Upgrade your home’s exterior with new siding",
      sub:"Compare local options for siding replacement, repair, and new installs — free and no obligation.",
      benefitsHead:"Compare siding options with confidence",
      steps:[
        {id:"project", type:"single", q:"What siding help do you need?", options:["Full siding replacement","Siding repair","New siding installation","Storm / damage repair","Not sure yet"]},
        {id:"material", type:"single", q:"Any material in mind?", options:["Vinyl","Fiber cement","Wood","Metal","Not sure"]},
        zip("Where is the siding project located?"),
        TIMELINE, OWNER, CONTACT
      ],
      faqs:[
        {q:"How much does new siding cost?", a:"It depends on your home's size, the material, and removal of old siding. Comparing local quotes is the best way to see real pricing."},
        {q:"Which siding material lasts longest?", a:"Fiber cement and metal are very durable, while vinyl is budget-friendly and low-maintenance. A local pro can recommend what fits your home and climate."}
      ].concat(GENERAL),
      seo:{
        label:"Siding guide", heading:"Siding replacement & repair options",
        lead:[
          "Siding is your home's first line of defense against the weather — and a major factor in curb appeal and energy efficiency. Whether you're repairing storm damage or replacing tired siding altogether, the material you choose affects looks, maintenance, and longevity.",
          "Siding costs in {area} depend on your home's square footage, the material, trim details, and whether old siding needs removal. Renue Home connects you with vetted local siding pros so you can compare free quotes without obligation."
        ],
        factors:[
          {h:"Home size & stories", p:"More exterior area and added height raise material and labor costs."},
          {h:"Material", p:"Vinyl, fiber cement, wood, and metal span a wide price and durability range."},
          {h:"Tear-off & prep", p:"Removing old siding and repairing sheathing adds to the job."},
          {h:"Trim & details", p:"Corners, soffits, and accents affect the finished cost."}
        ],
        types:[
          {h:"Vinyl siding", p:"Affordable, low-maintenance, many colors."},
          {h:"Fiber cement", p:"Durable, fire-resistant, and great-looking."},
          {h:"Wood siding", p:"Classic look; needs more upkeep."},
          {h:"Metal siding", p:"Modern, long-lasting, low-maintenance."}
        ]
      },
      gallery:["New fiber-cement siding","Vinyl siding replacement","Board-and-batten accent","Storm-damage repair","Modern metal siding","Full exterior makeover"]
    },

    plumbing:{
      name:"Plumbing", word:"plumbing", title:"Plumbing Quotes — Repair & Installation — Renue Home",
      headline:"Need a plumbing repair or upgrade?",
      sub:"Compare local plumbing pros for repairs, water heaters, repipes, and fixture installs — free and no obligation.",
      benefitsHead:"Find the right plumbing pro, faster",
      steps:[
        {id:"project", type:"single", q:"What do you need help with?", options:["Leak or repair","Water heater","Drain / sewer","Fixture install","Repipe","Not sure yet"]},
        {id:"urgency", type:"single", q:"How urgent is it?", options:["Emergency / ASAP","Within a few days","This month","Just researching"]},
        zip("Where do you need plumbing service?"),
        OWNER, CONTACT
      ],
      faqs:[
        {q:"Do you handle plumbing emergencies?", a:"Tell us your timeframe and we'll try to match you with local pros who can help on your schedule, including urgent leaks and outages."},
        {q:"How much does a water heater cost to replace?", a:"It depends on the type (tank vs. tankless), capacity, and install. Comparing local quotes is the best way to see fair pricing."}
      ].concat(GENERAL),
      seo:{
        label:"Plumbing guide", heading:"Plumbing repairs, water heaters & installs",
        lead:[
          "Plumbing problems rarely wait for a convenient time. From a dripping fixture to a failing water heater or a slab leak, getting the right pro quickly can prevent a small issue from becoming costly water damage.",
          "Plumbing pricing in {area} depends on the job, parts, and how accessible the work is. Renue Home matches you with local, vetted plumbers so you can compare quotes — and find someone fast when it's an emergency."
        ],
        factors:[
          {h:"Type of job", p:"A simple repair costs far less than a repipe or sewer line."},
          {h:"Parts & fixtures", p:"Water heaters, faucets, and valves vary in price."},
          {h:"Accessibility", p:"Hard-to-reach pipes and slab work take more labor."},
          {h:"Urgency", p:"Emergency and after-hours calls may cost more."}
        ],
        types:[
          {h:"Leak & repair", p:"Fix drips, burst pipes, and running fixtures."},
          {h:"Water heater", p:"Tank or tankless replacement and install."},
          {h:"Drain & sewer", p:"Clear clogs and repair sewer lines."},
          {h:"Repipe", p:"Replace aging pipes throughout the home."}
        ]
      },
      gallery:["Tankless water heater install","Under-sink leak repair","Whole-home repipe","Fixture & faucet upgrade","Drain & sewer service","Emergency leak response"]
    },

    "water-damage":{
      name:"Water Damage Restoration", word:"water damage", title:"Water Damage Restoration Quotes — Renue Home",
      headline:"Dealing with water damage or flooding?",
      sub:"Get matched with local water damage and restoration pros — fast help for leaks, floods, and mold.",
      benefitsHead:"Get help with water damage, fast",
      steps:[
        {id:"issue", type:"single", q:"What are you dealing with?", options:["Flooding / standing water","Leak damage","Mold / mildew","Storm damage","Sewage backup","Not sure yet"]},
        {id:"when", type:"single", q:"When did it happen?", options:["Happening now","Within 24 hours","A few days ago","Ongoing / not sure"]},
        zip("Where is the affected property?"),
        OWNER, CONTACT
      ],
      faqs:[
        {q:"How fast can someone come out?", a:"Water damage is time-sensitive. Tell us it's urgent and we'll try to match you with local restoration pros who offer rapid response."},
        {q:"Will insurance cover water damage?", a:"It can, depending on your policy and the cause. A local restoration pro can help assess and document the damage for your claim."}
      ].concat(GENERAL),
      seo:{
        label:"Water damage guide", heading:"Water damage restoration: act fast",
        lead:[
          "Water damage gets worse by the hour — soaked materials, hidden moisture, and mold can turn a small leak into a major repair. Fast extraction, drying, and restoration are key to limiting the damage and protecting your home's value.",
          "Restoration costs in {area} depend on the size of the affected area, the category of water, and how quickly drying begins. Renue Home connects you with local restoration pros who can respond quickly and help document damage for insurance."
        ],
        factors:[
          {h:"Affected area", p:"More square footage and multiple rooms increase the scope."},
          {h:"Water category", p:"Clean, gray, and black water require different handling."},
          {h:"Time elapsed", p:"The longer materials stay wet, the more must be replaced."},
          {h:"Mold remediation", p:"Existing mold adds specialized work and cost."}
        ],
        types:[
          {h:"Water extraction & drying", p:"Remove standing water and dry the structure."},
          {h:"Leak & flood repair", p:"Repair the source and damaged materials."},
          {h:"Mold remediation", p:"Safely remove and treat mold growth."},
          {h:"Storm & sewage cleanup", p:"Specialized cleanup for contaminated water."}
        ]
      },
      gallery:["Rapid water extraction","Structural drying equipment","Mold remediation","Flooded basement cleanup","Leak source repair","Insurance documentation"]
    },

    other:{
      name:"Home Projects", word:"home", title:"Get Matched With Local Home Pros — Renue Home",
      headline:"Tell us about your home project",
      sub:"Not sure which category fits? Start here and we’ll match you with the right local professionals.",
      benefitsHead:"One simple way to start any home project",
      steps:[
        {id:"project", type:"single", q:"What type of project do you need help with?", options:["Bathroom","Kitchen","Windows","Roofing","HVAC","Flooring","Solar","Gutters","Painting","Siding","Plumbing","Water damage","Something else"]},
        zip("Where would this project take place?"),
        TIMELINE, OWNER, CONTACT
      ],
      faqs:[].concat(GENERAL),
      seo:{
        label:"Home improvement guide", heading:"Start any home project with confidence",
        lead:[
          "Not every project fits neatly into one category — and that's fine. Whether you're planning a renovation, tackling a repair, or just exploring ideas, the first step is connecting with the right local professional for the job.",
          "Renue Home matches homeowners in {area} with vetted local pros across dozens of project types. Answer a few quick questions and compare free, no-obligation quotes."
        ],
        factors:[],
        types:[]
      },
      gallery:["Home renovation projects","Trusted local pros","Free project quotes","Compare your options","Indoor & outdoor work","Fresh starts at home"]
    }
  };
})();
