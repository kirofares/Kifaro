export type LectureAsset = {
  lectureId: string
  pptFile: string
  pdfFile: string
  videoUrl?: string
  storageStatus: 'ready' | 'pending'
}

export const lectureAssets: LectureAsset[] = [
  {
    lectureId: 'y1-found-01',
    pptFile: 'AnatoMate_Lecture_01_Introduction_to_Anatomy.pptx',
    pdfFile: 'AnatoMate_Lecture_01_Introduction_to_Anatomy.pdf',
    storageStatus: 'ready',
  },
  {
    lectureId: 'y2-cns-33',
    pptFile: 'Y2_33_Spinal_Cord_External.pptx',
    pdfFile: 'Y2_33_Spinal_Cord_External.pdf',
    storageStatus: 'ready',
  },
  {
    lectureId: 'y2-cns-34',
    pptFile: 'Y2_34_Spinal_Cord_Internal.pptx',
    pdfFile: 'Y2_34_Spinal_Cord_Internal.pdf',
    storageStatus: 'ready',
  },
]

export const getLectureAsset = (lectureId: string) =>
  lectureAssets.find((asset) => asset.lectureId === lectureId)
