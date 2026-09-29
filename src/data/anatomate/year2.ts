import type {Lecture} from '../types'

export const year2CnsLectures:Lecture[]=[
  {
    id:'y2-cns-30',slug:'developing-brain',title:'Developing Brain',year:2,module:'Central Nervous System',sequence:30,duration:58,system:'Neuroanatomy',status:'purchased',
    description:'From neural tube patterning to the adult CNS, with clinically relevant developmental correlations.',
    objectives:['Trace CNS development from ectoderm to neural tube','Differentiate alar and basal plates','Relate vesicle development to adult brain regions'],
    clinical:['Neural tube defects','Aqueductal stenosis','Developmental basis of ventricular anatomy'],
    pearls:['Alar plate is sensory; basal plate is motor','Marginal layer becomes white matter'],
    activeRecall:['What does the alar plate become?','Which embryonic layer becomes white matter?'],
    mcqs:[{question:'Which embryonic plate is primarily sensory?',options:['Basal plate','Alar plate','Floor plate','Roof plate'],answer:1,explanation:'The alar plate gives rise mainly to sensory regions.'}]
  },
  {
    id:'y2-cns-31',slug:'meninges',title:'Meninges',year:2,module:'Central Nervous System',sequence:31,duration:50,system:'Neuroanatomy',status:'purchased',
    description:'Dura, arachnoid and pia with cranial and spinal differences, spaces, cisterns and clinical bleeding patterns.',
    objectives:['Identify cranial and spinal meninges','Differentiate meningeal spaces','Apply meningeal anatomy to lumbar puncture and hemorrhage'],
    clinical:['Lumbar puncture','Epidural hematoma','Subdural hematoma','Subarachnoid hemorrhage'],
    pearls:['Lumbar puncture is performed below the end of the spinal cord','Epidural, subdural and subarachnoid bleeding have different anatomical compartments'],
    activeRecall:['Where is the lumbar cistern?','Which meningeal space contains CSF?'],
    mcqs:[{question:'CSF normally occupies which space?',options:['Epidural','Subdural','Subarachnoid','Intradural'],answer:2,explanation:'CSF circulates in the subarachnoid space.'}]
  },
  {
    id:'y2-cns-32',slug:'ventricular-system-csf',title:'Ventricular System & CSF',year:2,module:'Central Nervous System',sequence:32,duration:48,system:'Neuroanatomy',status:'purchased',
    description:'Ventricular anatomy, CSF production, circulation, absorption and hydrocephalus.',
    objectives:['Trace CSF from lateral ventricles to venous return','Identify Magendie and Luschka','Predict ventricular dilation in obstruction'],
    clinical:['Communicating hydrocephalus','Non-communicating hydrocephalus','Aqueductal stenosis'],
    pearls:['CSF is produced mainly by choroid plexus','Aqueductal stenosis enlarges ventricles proximal to the aqueduct'],
    activeRecall:['Name the median aperture','Where is CSF reabsorbed?'],
    mcqs:[{question:'Aqueductal stenosis most directly obstructs flow between:',options:['Lateral and third ventricles','Third and fourth ventricles','Fourth ventricle and central canal','Subarachnoid space and venous sinuses'],answer:1,explanation:'The cerebral aqueduct connects the third and fourth ventricles.'}]
  },
  {
    id:'y2-cns-33',slug:'spinal-cord-external-anatomy',title:'Spinal Cord: External Anatomy',year:2,module:'Central Nervous System',sequence:33,duration:52,system:'Neuroanatomy',status:'purchased',
    description:'External features of the spinal cord, enlargements, conus medullaris, cauda equina and filum terminale.',
    objectives:['Identify major external landmarks','Differentiate conus, cauda and filum','Explain why lumbar puncture is done below the cord'],
    clinical:['Cauda equina syndrome','Lumbar puncture'],
    pearls:['Conus medullaris is the tapered end of the cord','Cauda equina is a bundle of roots below the cord'],
    activeRecall:['What is the cauda equina?','Where does the cord end in adults?'],
    mcqs:[{question:'The cauda equina is best described as:',options:['The tapered end of the cord','A bundle of lumbar and sacral roots','A meningeal layer','A dural septum'],answer:1,explanation:'It consists of nerve roots descending below the conus medullaris.'}]
  },
  {
    id:'y2-cns-34',slug:'spinal-cord-internal-structure',title:'Spinal Cord: Internal Structure',year:2,module:'Central Nervous System',sequence:34,duration:55,system:'Neuroanatomy',status:'purchased',
    description:'Gray matter horns, white matter funiculi and level-by-level cross-sectional differences.',
    objectives:['Identify gray and white matter organization','Compare cervical, thoracic, lumbar and sacral levels','Relate tract position to lesion localization'],
    clinical:['Cord level localization'],
    pearls:['White matter increases toward cervical levels','Thoracic cord has a characteristic lateral horn'],
    activeRecall:['Which level has the most white matter?','Where is the lateral horn best developed?'],
    mcqs:[{question:'Which spinal cord region typically has the greatest proportion of white matter?',options:['Sacral','Lumbar','Thoracic','Cervical'],answer:3,explanation:'Ascending and descending fibers accumulate toward cervical levels.'}]
  },
  {
    id:'y2-cns-35',slug:'ascending-tracts',title:'Ascending Tracts',year:2,module:'Central Nervous System',sequence:35,duration:64,system:'Neuroanatomy',status:'purchased',
    description:'Dorsal column, spinothalamic and spinocerebellar pathways with crossing points and lesion patterns.',
    objectives:['Compare major ascending pathways','Identify modalities and crossing points','Predict sensory loss from tract lesions'],
    clinical:['Brown-Séquard pattern','Dorsal column lesion','Spinothalamic lesion'],
    pearls:['Crossing level determines side of sensory loss','Different sensory modalities travel in different pathways'],
    activeRecall:['Where does the dorsal column pathway cross?','Where does the spinothalamic pathway cross?'],
    mcqs:[{question:'A hemicord lesion classically affects pain and temperature on which side below the lesion?',options:['Ipsilateral','Contralateral','Bilateral equally','Neither side'],answer:1,explanation:'Spinothalamic fibers cross near their entry level, causing contralateral loss below the lesion.'}]
  },
  {
    id:'y2-cns-36',slug:'descending-tracts',title:'Descending Tracts',year:2,module:'Central Nervous System',sequence:36,duration:60,system:'Neuroanatomy',status:'purchased',
    description:'Corticospinal and related descending motor pathways with pyramidal decussation and UMN/LMN localization.',
    objectives:['Trace corticospinal pathways','Differentiate UMN and LMN lesions','Use decussation to predict side of weakness'],
    clinical:['Upper motor neuron lesion','Lower motor neuron lesion','Brain vs spinal cord localization'],
    pearls:['Lesions above pyramidal decussation produce contralateral weakness','Lesions below decussation produce ipsilateral weakness'],
    activeRecall:['Where do corticospinal fibers decussate?','Name one UMN sign'],
    mcqs:[{question:'A corticospinal lesion below the pyramidal decussation causes weakness that is usually:',options:['Contralateral','Ipsilateral','Bilateral','Purely sensory'],answer:1,explanation:'Below decussation the pathway has already crossed.'}]
  },
  {
    id:'y2-cns-37',slug:'medulla-oblongata',title:'Medulla Oblongata',year:2,module:'Central Nervous System',sequence:37,duration:62,system:'Brainstem',status:'purchased',
    description:'External and internal medullary anatomy, nuclei, pathways and localization of medial versus lateral lesions.',
    objectives:['Identify major medullary structures','Compare medial and lateral medullary anatomy','Connect structure to neurological deficit'],
    clinical:['Medial medullary syndrome','Lateral medullary syndrome'],
    pearls:['Motor structures are arranged more medially than many sensory structures','Lesion location predicts the deficit pattern'],
    activeRecall:['What is the function of the inferior olivary nucleus?','Which structures are affected in lateral medulla?'],
    mcqs:[{question:'A lateral medullary lesion is most associated with:',options:['Pure corticospinal weakness only','Brainstem sensory and autonomic deficits','Isolated frontal lobe signs','Cauda equina syndrome'],answer:1,explanation:'Lateral medullary lesions involve multiple brainstem nuclei and tracts.'}]
  },
  {
    id:'y2-cns-38',slug:'pons',title:'Pons',year:2,module:'Central Nervous System',sequence:38,duration:60,system:'Brainstem',status:'purchased',
    description:'External and internal pontine anatomy, cranial nerve nuclei, facial colliculus and clinical localization.',
    objectives:['Identify caudal and rostral pontine levels','Locate major cranial nerve nuclei','Predict deficits from focal pontine lesions'],
    clinical:['Facial colliculus lesion','Pontine localization'],
    pearls:['The facial colliculus reflects the abducens nucleus and facial nerve internal genu','Pontine level matters for localization'],
    activeRecall:['What creates the facial colliculus?','Which cranial nerve nuclei are found in the pons?'],
    mcqs:[{question:'The facial colliculus is formed mainly by:',options:['Facial nucleus alone','Abducens nucleus and internal genu of facial nerve','Vestibular nuclei','Trigeminal motor nucleus'],answer:1,explanation:'It overlies the abducens nucleus and the looping facial nerve fibers.'}]
  }
]
