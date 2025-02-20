// src/types/Profile.ts
export interface IExperience {
  empresa: string;
  cargo: string;
  periodo: string;
  descricao?: string;
  skills: string[];
}

export interface ICertification {
  nome: string;
  empresa: string;
  dataEmissao: string;
}

export interface IEducation {
  instituicao: string;
  curso: string;
  periodo: string;
}

export interface ISkill {
  nome: string;
  nivel?: string;
}

export interface IProfile {
  experiences: IExperience[];
  education: IEducation[];
  certifications: ICertification[];
  skills: ISkill[];
}