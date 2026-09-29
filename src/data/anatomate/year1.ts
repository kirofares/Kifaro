import type { Lecture } from '../types'

export const year1FoundationLectures: Lecture[] = [
  {
    id:'y1-found-01', slug:'introduction-to-anatomy', title:'Introduction to Anatomy', year:1,
    module:'General Anatomy Foundations', sequence:1, duration:42, system:'General Anatomy', status:'free',
    description:'Core anatomical language, position, planes, movements and the framework used throughout AnatoMate.',
    objectives:['Use standard anatomical position and directional terms','Identify major anatomical planes','Describe common movements accurately'],
    clinical:['Use anatomical language to describe examination findings and procedures'],
    pearls:['Anatomical descriptions assume the standard anatomical position','Median and sagittal planes are not interchangeable terms'],
    activeRecall:['Define anatomical position','Name the three main anatomical planes'],
    mcqs:[{question:'Which plane divides the body into anterior and posterior parts?',options:['Sagittal','Coronal','Transverse','Median'],answer:1,explanation:'The coronal plane divides the body into anterior and posterior portions.'}]
  },
  {
    id:'y1-found-02', slug:'joints-arthrology', title:'Joints & Arthrology', year:1,
    module:'General Anatomy Foundations', sequence:2, duration:46, system:'General Anatomy', status:'purchased',
    description:'Classification of joints, synovial joint structure and the relationship between form and movement.',
    objectives:['Classify joints structurally','Identify components of a synovial joint','Relate joint shape to permitted movement'],
    clinical:['Joint stability and dislocation','Basic principles of arthritis'],
    pearls:['Synovial joints contain a true joint cavity','Joint shape strongly influences available movement'],
    activeRecall:['What are the three structural classes of joints?','List the essential features of a synovial joint'],
    mcqs:[{question:'Which feature is characteristic of a synovial joint?',options:['No joint cavity','Fibrocartilage only','A joint cavity','Complete bony fusion'],answer:2,explanation:'A synovial joint has a true joint cavity.'}]
  },
  {
    id:'y1-found-03', slug:'muscles-myology', title:'Muscles & Myology', year:1,
    module:'General Anatomy Foundations', sequence:3, duration:48, system:'General Anatomy', status:'purchased',
    description:'Skeletal muscle architecture, attachments, actions and functional terminology.',
    objectives:['Describe common muscle architectures','Differentiate origin and insertion','Explain prime mover, antagonist and synergist'],
    clinical:['Muscle weakness and nerve injury','Functional testing of muscle groups'],
    pearls:['Muscle action depends on line of pull and joint position','A muscle can have different functional roles in different movements'],
    activeRecall:['Define agonist and antagonist','How does pennate architecture affect force?'],
    mcqs:[{question:'A muscle that opposes the action of a prime mover is called:',options:['Synergist','Antagonist','Fixator','Tensor'],answer:1,explanation:'An antagonist opposes or controls the action of the prime mover.'}]
  },
  {
    id:'y1-found-04', slug:'fascia-spaces-compartments', title:'Fascia, Spaces & Compartments', year:1,
    module:'General Anatomy Foundations', sequence:4, duration:44, system:'General Anatomy', status:'purchased',
    description:'Superficial and deep fascia, potential spaces, fascial compartments and why they matter clinically.',
    objectives:['Differentiate superficial and deep fascia','Explain formation of compartments','Relate fascial spaces to spread of infection'],
    clinical:['Compartment syndrome','Spread of infection through fascial planes'],
    pearls:['Deep fascia can form intermuscular septa','Closed fascial compartments can develop dangerous pressure'],
    activeRecall:['What forms an anatomical compartment?','Why can raised compartment pressure impair perfusion?'],
    mcqs:[{question:'Compartment syndrome is dangerous mainly because rising pressure can:',options:['Increase venous return','Compromise tissue perfusion','Strengthen fascia','Prevent edema'],answer:1,explanation:'Raised pressure within a closed compartment can compromise blood flow and tissue viability.'}]
  },
  {
    id:'y1-found-05', slug:'blood-vessels-lymphatics', title:'Blood Vessels & Lymphatics', year:1,
    module:'General Anatomy Foundations', sequence:5, duration:50, system:'General Anatomy', status:'purchased',
    description:'Arteries, veins, capillaries, anastomoses, lymphatic drainage and lymph nodes.',
    objectives:['Compare arteries and veins','Explain anastomoses and end arteries','Trace the basic logic of lymphatic drainage'],
    clinical:['Edema and lymphatic obstruction','End-artery ischemia'],
    pearls:['Lymph generally follows venous drainage patterns','Functional end arteries have limited effective collateral supply'],
    activeRecall:['What is an anastomosis?','Why can end-artery occlusion cause infarction?'],
    mcqs:[{question:'A vessel with little or no effective collateral supply is termed:',options:['Portal vein','End artery','Sinusoid','Venule'],answer:1,explanation:'An end artery has insufficient collateral circulation to maintain perfusion after occlusion.'}]
  },
  {
    id:'y1-found-06', slug:'introduction-nervous-system', title:'Introduction to the Nervous System', year:1,
    module:'General Anatomy Foundations', sequence:6, duration:52, system:'Neuroanatomy Foundations', status:'purchased',
    description:'Organization of the central and peripheral nervous systems, neurons, nerves, ganglia and basic pathways.',
    objectives:['Differentiate CNS and PNS','Define nerve, tract, nucleus and ganglion','Describe basic sensory and motor organization'],
    clinical:['Peripheral nerve lesion terminology','Basic neurological localization'],
    pearls:['Nucleus is a CNS term; ganglion is usually a PNS term','Tracts are CNS bundles; nerves are PNS bundles'],
    activeRecall:['Differentiate a nucleus from a ganglion','Differentiate a tract from a nerve'],
    mcqs:[{question:'A collection of neuronal cell bodies in the PNS is usually called a:',options:['Nucleus','Ganglion','Tract','Fasciculus'],answer:1,explanation:'Ganglion is the usual term for a collection of neuronal cell bodies in the peripheral nervous system.'}]
  },
  {
    id:'y1-found-07', slug:'skin-integumentary-system', title:'Skin & Integumentary System', year:1,
    module:'General Anatomy Foundations', sequence:7, duration:45, system:'General Anatomy', status:'purchased',
    description:'Layers of skin, appendages, cutaneous innervation and clinically useful surface anatomy.',
    objectives:['Identify epidermis and dermis','Describe major skin appendages','Relate cutaneous innervation to dermatomes'],
    clinical:['Burn depth','Dermatomal sensory examination'],
    pearls:['The epidermis is avascular','Dermatomes overlap and are not sharply isolated bands'],
    activeRecall:['Which skin layer is avascular?','What is a dermatome?'],
    mcqs:[{question:'Which layer of skin is avascular?',options:['Dermis','Epidermis','Hypodermis','Deep fascia'],answer:1,explanation:'The epidermis has no blood vessels and receives nutrients by diffusion from the dermis.'}]
  }
]
