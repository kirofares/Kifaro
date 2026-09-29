import {year2CnsLectures} from './year2'
import type {Lecture} from '../types'

export const anatomateLectures:Lecture[]=[...year2CnsLectures]
export const anatomateYears=[{year:2,label:'Year 2',modules:[{slug:'cns',title:'Central Nervous System',description:'Neurodevelopment, meninges, CSF, spinal cord, major tracts and brainstem.',lectures:year2CnsLectures}]}]
export const getLectureBySlug=(slug?:string)=>anatomateLectures.find(l=>l.slug===slug)
