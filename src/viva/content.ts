export type VivaText = { en: string; ar: string }
export type VivaQuestion = {
  id: string
  prompt: VivaText
  hint: VivaText
  criteria: VivaText[]
  source: { section: string; slide: number; excerpt: string }
}
export type VivaDeck = {
  id: string
  version: number
  lectureId: string
  sourceFilename: string
  questions: VivaQuestion[]
}

// Source: the user's AnatoMate_Lecture_01_Introduction_to_Anatomy.pptx,
// read on 2026-10-04. These are adapted recall prompts, not AI-generated
// grading rules. Slide numbers belong to THIS source edition only; the live
// protected PDF can be a different edition, so do not deep-link its pages.
// Only this free pilot is enabled. Do not derive answer keys from objectives
// or publish additional decks without checking their actual lecture source.
export const introViva: VivaDeck = {
  id: 'introduction-to-anatomy-v1',
  version: 1,
  lectureId: 'y1-found-01',
  sourceFilename: 'AnatoMate_Lecture_01_Introduction_to_Anatomy.pptx',
  questions: [
    {
      id: 'definition',
      prompt: { en: 'What does anatomy study? Include both parts of the definition.', ar: 'ما الذي يدرسه علم التشريح؟ اذكر الجزأين الأساسيين للتعريف.' },
      hint: { en: 'Think about a body part and what is around it.', ar: 'فكّر في جزء من الجسم وما يوجد حوله.' },
      criteria: [
        { en: 'The structure of the body.', ar: 'تركيب الجسم: Body structure.' },
        { en: 'The relationships between its parts.', ar: 'العلاقات بين أجزاء الجسم: Relationships.' },
      ],
      source: { section: 'What is Anatomy?', slide: 3, excerpt: 'Anatomy = the study of BODY STRUCTURE and the RELATIONSHIPS between its parts.' },
    },
    {
      id: 'position',
      prompt: { en: 'Describe the standard anatomical position.', ar: 'صِف الوضع التشريحي القياسي: Anatomical position.' },
      hint: { en: 'Describe the body, head, arms, palms and feet.', ar: 'صِف الجسم والرأس والذراعين وراحتي اليدين والقدمين.' },
      criteria: [
        { en: 'Standing upright.', ar: 'الجسم واقف مستقيمًا.' },
        { en: 'Head and eyes facing forward.', ar: 'الرأس والعينان متجهتان للأمام.' },
        { en: 'Upper limbs by the side.', ar: 'الطرفان العلويان بجانب الجسم.' },
        { en: 'Palms facing forward.', ar: 'راحتا اليدين متجهتان للأمام.' },
        { en: 'Lower limbs together, feet facing forward.', ar: 'الطرفان السفليان معًا والقدمان متجهتان للأمام.' },
      ],
      source: { section: 'Anatomical Position', slide: 5, excerpt: 'Standing upright; head and eyes facing forward; upper limbs by the side; palms facing forward; lower limbs together / feet forward.' },
    },
    {
      id: 'planes',
      prompt: { en: 'Name the three main anatomical planes and explain how each divides the body.', ar: 'اذكر المستويات التشريحية الثلاثة، واشرح كيف يقسم كل مستوى الجسم.' },
      hint: { en: 'Use the pairs right/left, front/back and upper/lower.', ar: 'استخدم الأزواج: يمين/يسار، أمام/خلف، أعلى/أسفل.' },
      criteria: [
        { en: 'Sagittal: right and left parts.', ar: 'Sagittal: جزء أيمن وجزء أيسر.' },
        { en: 'Coronal / frontal: anterior and posterior parts.', ar: 'Coronal / frontal: جزء أمامي وجزء خلفي.' },
        { en: 'Transverse / horizontal: superior and inferior parts.', ar: 'Transverse / horizontal: جزء علوي وجزء سفلي.' },
      ],
      source: { section: 'Anatomical Planes', slide: 6, excerpt: 'Sagittal Plane: RIGHT and LEFT parts. Coronal / Frontal Plane: FRONT and BACK parts. Transverse / Horizontal Plane: UPPER and LOWER parts.' },
    },
    {
      id: 'direction',
      prompt: { en: 'The wrist is proximal or distal to the elbow? Explain your choice.', ar: 'هل الرسغ Proximal أم Distal بالنسبة للكوع؟ اشرح السبب.' },
      hint: { en: 'Compare the distance of each structure from the trunk.', ar: 'قارن بُعد كل جزء عن الجذع.' },
      criteria: [
        { en: 'The wrist is distal to the elbow.', ar: 'الرسغ Distal بالنسبة للكوع.' },
        { en: 'Distal means farther from the trunk.', ar: 'Distal تعني أبعد عن الجذع.' },
      ],
      source: { section: 'Directional Terms / Quick Check', slide: 7, excerpt: 'Proximal ↔ Distal: near trunk ↔ farther away. Quick Check (slide 12): The wrist is distal to the elbow.' },
    },
    {
      id: 'cavity',
      prompt: { en: 'Which body cavity contains the lungs? Name two other contents listed in this lecture.', ar: 'أي تجويف يحتوي على الرئتين؟ اذكر محتويين آخرين وردا في المحاضرة.' },
      hint: { en: 'Think about the chest and the structures involved in circulation.', ar: 'فكّر في الصدر والتركيبات المرتبطة بالدورة الدموية.' },
      criteria: [
        { en: 'The thoracic cavity contains the lungs.', ar: 'التجويف الصدري Thoracic cavity يحتوي على الرئتين.' },
        { en: 'The heart.', ar: 'القلب: Heart.' },
        { en: 'Major vessels.', ar: 'الأوعية الدموية الكبرى: Major vessels.' },
      ],
      source: { section: 'Body Cavities', slide: 9, excerpt: 'Thoracic Cavity: Pleural cavities + mediastinum. Contains lungs, heart and major vessels.' },
    },
  ],
}

export function getVivaDeck(lectureId: string): VivaDeck | undefined {
  return lectureId === introViva.lectureId ? introViva : undefined
}
