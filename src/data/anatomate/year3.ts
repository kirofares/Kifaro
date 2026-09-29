import type { Lecture } from '../types'

const abdomenBase='/assets/anatomate/year3/abdomen'
const hnBase='/assets/anatomate/year3/head-neck'

function make(
  id:string, slug:string, title:string, module:string, sequence:number, system:string,
  stem:string, base:string, description:string, question:string, options:string[], answer:number
):Lecture{
  return {
    id,slug,title,year:3,module,sequence,duration:50,system,status:'purchased',
    description,
    objectives:['Identify the major anatomical features','Explain the important relations','Connect the anatomy to common clinical applications'],
    clinical:['Clinical localization and applied anatomy relevant to this region'],
    pearls:['Prioritize relations, blood supply, innervation and clinically important spaces'],
    activeRecall:['Name the key structures and their most important relations','What is the main clinical correlation for this topic?'],
    mcqs:[{question,options,answer,explanation:'Review the anatomical relationship highlighted in this lecture.'}],
    slidesUrl:base+'/'+stem+'.pptx',
    pdfUrl:base+'/'+stem+'.pdf'
  }
}

export const year3AbdomenLectures:Lecture[]=[
  make('y3-abd-01','introduction-to-abdomen','Introduction to Abdomen','Abdomen',1,'Regional Anatomy','Y3_A01_Introduction_to_Abdomen',abdomenBase,'Surface anatomy, abdominal divisions, regions and the framework for studying abdominal viscera.','The abdomen is commonly divided clinically into how many quadrants?',['2','4','6','8'],1),
  make('y3-abd-02','anterior-abdominal-wall','Anterior Abdominal Wall','Abdomen',2,'Regional Anatomy','Y3_A02_Anterior_Abdominal_Wall',abdomenBase,'Layers, muscles, fascia, vessels, nerves and clinically important landmarks of the anterior abdominal wall.','Which muscle contributes to the rectus sheath?',['Rectus femoris','External oblique','Gluteus medius','Deltoid'],1),
  make('y3-abd-03','inguinal-canal','Inguinal Canal','Abdomen',3,'Regional Anatomy','Y3_A03_Inguinal_Canal',abdomenBase,'Boundaries, contents and anatomical logic of the inguinal canal.','The deep inguinal ring is an opening in the:',['External oblique aponeurosis','Transversalis fascia','Rectus sheath','Linea alba'],1),
  make('y3-abd-04','inguinal-hernias','Inguinal Hernias','Abdomen',4,'Clinical Anatomy','Y3_A04_Inguinal_Hernias',abdomenBase,'Direct and indirect inguinal hernias explained through the anatomy of the inguinal region.','An indirect inguinal hernia enters through the:',['Superficial ring only','Deep inguinal ring','Femoral canal','Obturator canal'],1),
  make('y3-abd-05','rectus-sheath','Rectus Sheath','Abdomen',5,'Regional Anatomy','Y3_A05_Rectus_Sheath',abdomenBase,'Formation and contents of the rectus sheath above and below the arcuate line.','Below the arcuate line, the aponeuroses pass mainly:',['Anterior to rectus abdominis','Posterior to rectus abdominis','Inside the muscle','Into the inguinal canal'],0),
  make('y3-abd-06','peritoneum','Peritoneum','Abdomen',6,'Regional Anatomy','Y3_A06_Peritoneum',abdomenBase,'Peritoneal layers, sacs, folds, mesenteries and clinically important spaces.','The greater sac communicates with the lesser sac through the:',['Aortic hiatus','Epiploic foramen','Inguinal canal','Obturator foramen'],1),
  make('y3-abd-09','abdominal-esophagus','Abdominal Esophagus','Abdomen',9,'Gastrointestinal Anatomy','Y3_A09_Abdominal_Esophagus',abdomenBase,'The short abdominal segment of the esophagus and its relations at the diaphragm and stomach.','The esophagus passes through the diaphragm at approximately:',['T6','T8','T10','T12'],2),
  make('y3-abd-10','stomach','Stomach','Abdomen',10,'Gastrointestinal Anatomy','Y3_A10_Stomach',abdomenBase,'Gross anatomy, relations, blood supply, lymphatics and innervation of the stomach.','The greater curvature is supplied in part by the:',['Right and left gastro-omental arteries','Radial artery','Inferior mesenteric artery only','Internal thoracic artery'],0),
  make('y3-abd-13','cecum-vermiform-appendix','Cecum & Vermiform Appendix','Abdomen',13,'Gastrointestinal Anatomy','Y3_A13_Cecum_Appendix',abdomenBase,'Anatomy of the cecum and appendix with positions, blood supply and appendicitis correlations.','The appendicular artery commonly arises from the:',['Ileocolic artery','Splenic artery','Left gastric artery','Inferior phrenic artery'],0)
]

export const year3HeadNeckLectures:Lecture[]=[
  make('y3-hn-01','oral-cavity','Oral Cavity','Head & Neck',1,'Head & Neck Anatomy','Y3_HN01_Oral_Cavity',hnBase,'Boundaries, subdivisions and clinically important contents of the oral cavity.','The oral cavity proper lies primarily:',['Outside the dental arches','Inside the dental arches','Inside the nasal cavity','Within the orbit'],1),
  make('y3-hn-02','palate','Palate','Head & Neck',2,'Head & Neck Anatomy','Y3_HN02_Palate',hnBase,'Hard and soft palate anatomy, muscles, vessels, nerves and clinical correlations.','The posterior muscular part of the palate is the:',['Hard palate','Soft palate','Nasal septum','Oral vestibule'],1),
  make('y3-hn-03','tongue','Tongue','Head & Neck',3,'Head & Neck Anatomy','Y3_HN03_Tongue',hnBase,'Muscles, innervation, blood supply, lymphatics and surface anatomy of the tongue.','General sensation from the anterior two-thirds of the tongue is mainly carried by the:',['Lingual nerve','Glossopharyngeal nerve','Vagus nerve','Hypoglossal nerve'],0),
  make('y3-hn-04','pharynx','Pharynx','Head & Neck',4,'Head & Neck Anatomy','Y3_HN04_Pharynx',hnBase,'Nasopharynx, oropharynx and laryngopharynx with muscles, fascia and neurovascular supply.','The pharynx is divided into how many major parts?',['2','3','4','5'],1),
  make('y3-hn-05','oesophagus','Oesophagus','Head & Neck',5,'Head & Neck Anatomy','Y3_HN05_Oesophagus',hnBase,'Cervical and thoracic esophageal anatomy, constrictions and clinically important relations.','One normal esophageal constriction occurs where it is crossed by the:',['Aortic arch','Femoral artery','Portal vein','Ureter'],0)
]
