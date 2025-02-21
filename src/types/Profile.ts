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
  endorsements?: number;
}

export interface IProfile {
  name: string;
  headline?: string;
  location?: string;
  experiences?: IExperience[];
  education?: IEducation[];
  skills?: ISkill[];
  certifications?: ICertification[];
  lastUpdate?: Date;
}

// Interface para respostas da API
export interface IProfileResponse extends Omit<IProfile, "lastUpdate"> {
  lastUpdate: Date;
  fromCache: boolean;
}

// Interface para erros
export interface IProfileError {
  error: string;
  details?: string;
}
