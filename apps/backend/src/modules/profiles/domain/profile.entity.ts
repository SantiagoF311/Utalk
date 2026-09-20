export class ProfileEntity {
  constructor(
    readonly id: string,
    readonly username: string,
    readonly universityId: string,
    readonly createdAt: Date,
  ) {}

  belongsTo(userId: string): boolean {
    return this.id === userId;
  }

  belongsToUniversity(universityId: string): boolean {
    return this.universityId === universityId;
  }
}
