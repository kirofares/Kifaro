export type LectureStatus='free'|'purchased'

export type Lecture={
  id:string
  slug:string
  title:string
  year:1|2|3
  module:string
  sequence:number
  duration:number
  system:string
  status:LectureStatus
  description:string
  objectives:string[]
  clinical:string[]
  pearls:string[]
  activeRecall:string[]
  mcqs:{question:string;options:string[];answer:number;explanation:string}[]
  videoUrl?:string
  slidesUrl?:string
  pdfUrl?:string
  /** Curriculum slot without authored notes yet (may still have an uploaded video or Datashow). */
  placeholder?:boolean
  /** Medical reviewer who signed off the lecture content, and when (ISO date). */
  reviewedBy?:string
  reviewedAt?:string
}
