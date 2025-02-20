// src/types/Profile.ts
export interface IExperience {
  title: string;
  company: string;
  duration: string;
  description?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  isCurrentRole?: boolean;
  periodo?: string;
  cargo?: string;
  empresa?: string;
  descricao?: string;
  skills?: string[];
}

export interface ICertification {
  name: string;
  organization: string;
  issueDate: string;
  expirationDate?: string;
  credentialId?: string;
  credentialUrl?: string;
}

export interface IEducation {
  school: string;
  degree: string;
  period: string;
  fieldOfStudy?: string;
  startDate?: string;
  endDate?: string;
  activities?: string[];
  description?: string;
}

export interface ISkill {
  name: string;
  endorsements: number;
  category?: string;
  proficiency?: string;
  nome?: string;
  nivel?: string;
}

export interface IProfile {
  name: string;
  headline?: string;
  location?: string;
  summary?: string;
  profilePictureUrl?: string;
  connectionDegree?: number;
  experiences: IExperience[];
  education: IEducation[];
  skills: ISkill[];
  certifications: ICertification[];
  languages?: string[];
  lastUpdate?: Date;
  fromCache?: boolean;
}

// Interface para respostas da API
export interface IProfileResponse extends IProfile {
  lastUpdate: Date;
  fromCache: boolean;
}

// Interface para erros
export interface IProfileError {
  error: string;
  details?: string;
  code?: number;
}