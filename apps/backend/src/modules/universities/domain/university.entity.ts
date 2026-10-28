export class UniversityEntity {
  constructor(
    readonly id: string,
    readonly slug: string,
    readonly name: string,
    readonly emailDomain: string,
    readonly createdAt: Date,
  ) {}

  matchesEmail(email: string): boolean {
    const domain = email.split('@')[1]?.toLowerCase();
    return domain === this.emailDomain.toLowerCase();
  }
}
