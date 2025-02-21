import axios from "axios";
import * as cheerio from "cheerio";
import type { IExperience, ISkill } from "src/types/Profile";
import type {
  ICertification,
  IEducation,
  LinkedInProfile,
} from "../types/linkedin";
import type { ApiData } from "../types/linkedin";

interface ApiPeriod {
  start: { year: number; month?: number };
  end?: { year: number; month?: number };
}

export class LinkedInScrapper {
  private readonly headers: Record<string, string>;

  constructor(token: string) {
    this.headers = {
      Cookie: token,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "application/vnd.linkedin.normalized+json+2.1",
    };
  }

  public async validateToken(): Promise<boolean> {
    try {
      const response = await axios.get(
        "https://www.linkedin.com/voyager/api/me",
        {
          headers: this.headers,
          maxRedirects: 5,
          validateStatus: () => true,
        },
      );
      return response.status === 200;
    } catch (error) {
      console.error("Erro ao validar token:", error);
      return false;
    }
  }

  public async extrairPerfil(username: string): Promise<LinkedInProfile> {
    try {
      const response = await axios.get(
        `https://www.linkedin.com/in/${username}`,
        { headers: this.headers },
      );

      const $ = cheerio.load(response.data);

      return {
        name: this.extractName($),
        headline: this.extractHeadline($),
        location: this.extractLocation($),
        profileUrl: `https://www.linkedin.com/in/${username}`,
        experiences: this.parseExperiencesFromApi(response.data).map((exp) => ({
          title: exp.title,
          company: exp.company,
          duration: exp.duration,
          location: exp.location,
          description: exp.description,
          startDate: exp.startDate,
          endDate: exp.endDate,
          isCurrentRole: exp.isCurrentRole,
        })),
        education: this.extractEducation($).map((edu) => ({
          school: edu.school,
          degree: edu.degree,
          field: edu.field,
          duration: edu.duration,
        })),
        skills: this.extractSkills($).map((skill) => skill.name),
        certifications: this.extractCertifications($).map((cert) => ({
          name: cert.name,
          issuer: cert.issuer,
          issueDate: cert.issueDate,
          expirationDate: cert.expirationDate,
        })),
      };
    } catch (error) {
      console.error("Erro ao extrair perfil:", error);
      throw new Error("Falha ao extrair dados do perfil");
    }
  }

  private extractName($: cheerio.Root): string {
    return $(".text-heading-xlarge").first().text().trim();
  }

  private extractHeadline($: cheerio.Root): string {
    return $(".text-body-medium").first().text().trim();
  }

  private extractLocation($: cheerio.Root): string {
    return $(".text-body-small").first().text().trim();
  }

  private extractEducation($: cheerio.Root): IEducation[] {
    const education: IEducation[] = [];
    $(".education-item").each((_, el) => {
      education.push({
        school: $(el).find(".education-item-school").text().trim(),
        degree: $(el).find(".education-item-degree").text().trim(),
        field: $(el).find(".education-item-field").text().trim(),
        duration: $(el).find(".education-item-period").text().trim(),
      });
    });
    return education;
  }

  private extractSkills($: cheerio.Root): ISkill[] {
    try {
      const skills: ISkill[] = [];
      $(".skill-category-entity__name").each((_, element) => {
        skills.push({
          name: $(element).text().trim(),
          endorsements: 0, // Se quiser extrair endorsements, precisaria adicionar a lógica aqui
        });
      });
      return skills;
    } catch (error) {
      console.error("Erro ao extrair skills:", error);
      return [];
    }
  }

  private extractCertifications($: cheerio.Root): ICertification[] {
    const certifications: ICertification[] = [];
    $(".certification-item").each((_, el) => {
      certifications.push({
        name: $(el).find(".certification-item-title").text().trim(),
        issuer: $(el).find(".certification-item-org").text().trim(),
        issueDate: $(el).find(".certification-item-date").text().trim(),
        expirationDate: undefined,
      });
    });
    return certifications;
  }

  private parseExperiencesFromApi(apiResponse: ApiData): IExperience[] {
    const experiences = apiResponse.included
      .filter((item) =>
        item.$type.includes(
          "com.linkedin.voyager.dash.identity.profile.Position",
        ),
      )
      .map((exp): IExperience => {
        const period = exp.dateRange ? this.formatPeriod(exp.dateRange) : "";

        return {
          title: exp.title || "",
          company: exp.companyName || "",
          duration: period,
          description: exp.description,
          startDate: exp.dateRange?.start
            ? `${exp.dateRange.start.year}-${exp.dateRange.start.month || "01"}`
            : undefined,
          endDate: exp.dateRange?.end
            ? `${exp.dateRange.end.year}-${exp.dateRange.end.month || "01"}`
            : undefined,
          isCurrentRole: !exp.dateRange?.end,
          periodo: period,
          cargo: exp.title || "",
          empresa: exp.companyName || "",
          descricao: exp.description,
          skills: [],
        };
      })
      .sort((a, b) => {
        const aDate = a.startDate ? new Date(a.startDate).getTime() : 0;
        const bDate = b.startDate ? new Date(b.startDate).getTime() : 0;
        return bDate - aDate;
      });

    return experiences;
  }

  private formatPeriod(period: ApiPeriod): string {
    const startDate = period.start
      ? `${period.start.year}-${period.start.month?.toString().padStart(2, "0") || "01"}`
      : "";
    const endDate = period.end
      ? `${period.end.year}-${period.end.month?.toString().padStart(2, "0") || "01"}`
      : "Presente";

    return `${startDate} até ${endDate}`;
  }
}
