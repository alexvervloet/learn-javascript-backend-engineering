class Influencer {
  numSelfies: number;
  numBioLinks: number;

  constructor(numSelfies: number, numBioLinks: number) {
    this.numSelfies = numSelfies;
    this.numBioLinks = numBioLinks;
  }

  toString(): string {
    return `(${this.numSelfies}, ${this.numBioLinks})`;
  }
}

function vanity(influencer: Influencer): number {
  return influencer.numBioLinks * 5 + influencer.numSelfies;
}

function vanitySort(influencers: Influencer[]): Influencer[] {
  return [...influencers].sort((a, b) => vanity(a) - vanity(b));
}

export { Influencer, vanity, vanitySort };
