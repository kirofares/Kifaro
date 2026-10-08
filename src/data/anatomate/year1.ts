import type { Lecture } from '../types'

const base = '/assets/anatomate/year1'

export const year1OrientationLectures: Lecture[] = [
  {
    id:'y1-orientation-01',slug:'anatomate-intro-talk',title:'Welcome to AnatoMate',year:1,module:'Orientation',sequence:1,duration:18,system:'Orientation',status:'free',
    description:'A short orientation to the AnatoMate learning system and how the course is structured.',
    objectives:['Understand the AnatoMate learning approach','Know how lectures, clinical bridges and recall tools are organized'],
    clinical:['How anatomical knowledge supports clinical thinking from the first year'],
    pearls:['See it, understand it, connect it, remember it'],
    activeRecall:['What is the AnatoMate learning sequence?'],
    mcqs:[],
    slidesUrl:base+'/orientation/Y1_M0_AnatoMate_Intro_Talk.pptx',pdfUrl:base+'/orientation/Y1_M0_AnatoMate_Intro_Talk.pdf'
  },
  {
    id:'y1-orientation-02',slug:'how-to-study-anatomy',title:'How to Study Anatomy',year:1,module:'Orientation',sequence:2,duration:34,system:'Study Skills',status:'free',
    description:'A practical framework for learning anatomy efficiently using visual learning and active recall.',
    objectives:['Use a structured anatomy study workflow','Apply active recall and spaced review','Connect structures to function and clinical meaning'],
    clinical:['Build habits that improve later clinical localization'],
    pearls:['Active recall beats passive rereading','Study relationships before isolated details'],
    activeRecall:['What should you do after first understanding a structure?'],
    mcqs:[],
    slidesUrl:base+'/orientation/Y1_M0_How_to_Study_Anatomy.pptx',pdfUrl:base+'/orientation/Y1_M0_How_to_Study_Anatomy.pdf'
  }
]

export const year1FoundationLectures: Lecture[] = [
  {
    id:'y1-found-01',slug:'introduction-to-anatomy',title:'Introduction to Anatomy',year:1,module:'General Anatomy Foundations',sequence:1,duration:42,system:'General Anatomy',status:'free',
    description:'Core anatomical language, position, planes, movements and the framework used throughout AnatoMate.',
    objectives:['Use standard anatomical position and directional terms','Identify major anatomical planes','Describe common movements accurately'],
    clinical:['Use anatomical language to describe examination findings and procedures'],
    pearls:['Anatomical descriptions assume the standard anatomical position','Median and sagittal planes are not interchangeable terms'],
    activeRecall:['Define anatomical position','Name the three main anatomical planes'],
    mcqs:[],
    slidesUrl:base+'/foundations/Y1_01_Introduction_to_Anatomy.pptx',pdfUrl:base+'/foundations/Y1_01_Introduction_to_Anatomy.pdf'
  },
  {
    id:'y1-found-02',slug:'introduction-to-skeleton',title:'Introduction to the Skeleton',year:1,module:'General Anatomy Foundations',sequence:2,duration:45,system:'General Anatomy',status:'purchased',
    description:'Bone classification, skeletal organization, surface markings and the structural logic of the skeleton.',
    objectives:['Classify bones by shape','Identify major skeletal divisions','Recognize common bone markings'],
    clinical:['Fracture description and interpretation of skeletal landmarks'],
    pearls:['Bone shape reflects function','Surface markings often indicate attachment or passage'],
    activeRecall:['Name the main bone shape classes','Differentiate axial and appendicular skeleton'],
    mcqs:[],
    slidesUrl:base+'/foundations/Y1_02_Introduction_to_Skeleton.pptx',pdfUrl:base+'/foundations/Y1_02_Introduction_to_Skeleton.pdf'
  },
  {
    id:'y1-found-03',slug:'joints-arthrology',title:'Joints & Arthrology',year:1,module:'General Anatomy Foundations',sequence:3,duration:46,system:'General Anatomy',status:'purchased',
    description:'Classification of joints, synovial joint structure and the relationship between form and movement.',
    objectives:['Classify joints structurally','Identify components of a synovial joint','Relate joint shape to permitted movement'],
    clinical:['Joint stability and dislocation','Basic principles of arthritis'],
    pearls:['Synovial joints contain a true joint cavity','Joint shape strongly influences available movement'],
    activeRecall:['What are the three structural classes of joints?','List the essential features of a synovial joint'],
    mcqs:[],
    slidesUrl:base+'/foundations/Y1_03_Joints_Arthrology.pptx',pdfUrl:base+'/foundations/Y1_03_Joints_Arthrology.pdf'
  },
  {
    id:'y1-found-04',slug:'muscles-myology',title:'Muscles & Myology',year:1,module:'General Anatomy Foundations',sequence:4,duration:48,system:'General Anatomy',status:'purchased',
    description:'Skeletal muscle architecture, attachments, actions and functional terminology.',
    objectives:['Describe common muscle architectures','Differentiate origin and insertion','Explain prime mover, antagonist and synergist'],
    clinical:['Muscle weakness and nerve injury','Functional testing of muscle groups'],
    pearls:['Muscle action depends on line of pull and joint position','A muscle can have different functional roles in different movements'],
    activeRecall:['Define agonist and antagonist','How does pennate architecture affect force?'],
    mcqs:[],
    slidesUrl:base+'/foundations/Y1_04_Muscles_Myology.pptx',pdfUrl:base+'/foundations/Y1_04_Muscles_Myology.pdf'
  },
  {
    id:'y1-found-05',slug:'fascia-spaces-compartments',title:'Fascia, Spaces & Compartments',year:1,module:'General Anatomy Foundations',sequence:5,duration:44,system:'General Anatomy',status:'purchased',
    description:'Superficial and deep fascia, potential spaces, fascial compartments and why they matter clinically.',
    objectives:['Differentiate superficial and deep fascia','Explain formation of compartments','Relate fascial spaces to spread of infection'],
    clinical:['Compartment syndrome','Spread of infection through fascial planes'],
    pearls:['Deep fascia can form intermuscular septa','Closed fascial compartments can develop dangerous pressure'],
    activeRecall:['What forms an anatomical compartment?','Why can raised compartment pressure impair perfusion?'],
    mcqs:[],
    slidesUrl:base+'/foundations/Y1_05_Fascia_Spaces_Compartments.pptx',pdfUrl:base+'/foundations/Y1_05_Fascia_Spaces_Compartments.pdf'
  },
  {
    id:'y1-found-06',slug:'blood-vessels',title:'Blood Vessels',year:1,module:'General Anatomy Foundations',sequence:6,duration:45,system:'General Anatomy',status:'purchased',
    description:'Arteries, veins, capillaries, anastomoses and the anatomical logic of vascular supply.',
    objectives:['Compare arteries and veins','Explain anastomoses and end arteries','Recognize common vascular patterns'],
    clinical:['End-artery ischemia','Collateral circulation'],
    pearls:['Functional end arteries have limited effective collateral supply'],
    activeRecall:['What is an anastomosis?','Why can end-artery occlusion cause infarction?'],
    mcqs:[],
    slidesUrl:base+'/foundations/Y1_06_Blood_Vessels.pptx',pdfUrl:base+'/foundations/Y1_06_Blood_Vessels.pdf'
  },
  {
    id:'y1-found-07',slug:'lymphatic-system',title:'Lymphatic System',year:1,module:'General Anatomy Foundations',sequence:7,duration:46,system:'General Anatomy',status:'purchased',
    description:'Lymphatic vessels, nodes, drainage patterns and the anatomical basis of lymph spread.',
    objectives:['Explain lymphatic drainage','Identify the role of lymph nodes','Relate lymphatic pathways to clinical spread'],
    clinical:['Lymphedema','Lymph node enlargement and metastatic spread'],
    pearls:['Lymphatic drainage often follows regional vascular anatomy'],
    activeRecall:['What is the role of a lymph node?','Where does lymph ultimately return to the circulation?'],
    mcqs:[],
    slidesUrl:base+'/foundations/Y1_07_Lymphatic_System.pptx',pdfUrl:base+'/foundations/Y1_07_Lymphatic_System.pdf'
  },
  {
    id:'y1-found-08',slug:'introduction-nervous-system',title:'Introduction to the Nervous System',year:1,module:'General Anatomy Foundations',sequence:8,duration:52,system:'Neuroanatomy Foundations',status:'purchased',
    description:'Organization of the central and peripheral nervous systems, neurons, nerves, ganglia and basic pathways.',
    objectives:['Differentiate CNS and PNS','Define nerve, tract, nucleus and ganglion','Describe basic sensory and motor organization'],
    clinical:['Peripheral nerve lesion terminology','Basic neurological localization'],
    pearls:['Nucleus is a CNS term; ganglion is usually a PNS term','Tracts are CNS bundles; nerves are PNS bundles'],
    activeRecall:['Differentiate a nucleus from a ganglion','Differentiate a tract from a nerve'],
    mcqs:[],
    slidesUrl:base+'/foundations/Y1_08_Introduction_to_Nervous_System.pptx',pdfUrl:base+'/foundations/Y1_08_Introduction_to_Nervous_System.pdf'
  },
  {
    id:'y1-found-09',slug:'skin-integumentary-system',title:'Skin & Integumentary System',year:1,module:'General Anatomy Foundations',sequence:9,duration:45,system:'General Anatomy',status:'purchased',
    description:'Layers of skin, appendages, cutaneous innervation and clinically useful surface anatomy.',
    objectives:['Identify epidermis and dermis','Describe major skin appendages','Relate cutaneous innervation to dermatomes'],
    clinical:['Burn depth','Dermatomal sensory examination'],
    pearls:['The epidermis is avascular','Dermatomes overlap and are not sharply isolated bands'],
    activeRecall:['Which skin layer is avascular?','What is a dermatome?'],
    mcqs:[],
    slidesUrl:base+'/foundations/Y1_09_Skin_Integumentary_System.pptx',pdfUrl:base+'/foundations/Y1_09_Skin_Integumentary_System.pdf'
  },
  {
    id:'y1-found-10',slug:'general-anatomy-integration',title:'General Anatomy Integration',year:1,module:'General Anatomy Foundations',sequence:10,duration:50,system:'General Anatomy',status:'purchased',
    description:'An integration lecture connecting the major concepts of general anatomy into one review framework.',
    objectives:['Integrate skeletal, joint, muscle, fascial, vascular, lymphatic and nervous concepts','Use relationships to solve anatomy questions'],
    clinical:['Integrated clinical anatomy reasoning'],
    pearls:['Integration is the goal: structure, relationship, function and clinical meaning'],
    activeRecall:['Build a structure-to-clinical chain for one region'],
    mcqs:[],
    slidesUrl:base+'/foundations/Y1_10_General_Anatomy_Integration.pptx',pdfUrl:base+'/foundations/Y1_10_General_Anatomy_Integration.pdf'
  }
]

export const year1PracticalLectures: Lecture[] = [
  {
    id:'y1-practical-scapula',slug:'scapula-practical',title:'Scapula Practical',year:1,module:'Upper Limb Practical',sequence:1,duration:35,system:'Upper Limb',status:'purchased',
    description:'Visual practical anatomy of the scapula with landmarks, attachments and exam identification.',
    objectives:['Identify scapular surfaces, borders and angles','Locate major processes and fossae','Relate landmarks to muscle attachments'],
    clinical:['Scapular fractures and shoulder mechanics'],
    pearls:['Orientation comes before memorizing attachments'],
    activeRecall:['Name the three borders of the scapula','Which process articulates with the clavicle?'],
    mcqs:[],
    slidesUrl:base+'/practical/Y1_Practical_Scapula.pptx',pdfUrl:base+'/practical/Y1_Practical_Scapula.pdf'
  }
]
