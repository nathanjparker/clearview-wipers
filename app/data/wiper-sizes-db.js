/**
 * Wiper blade size database by vehicle make & model.
 * Keys: "Make_Model" (e.g. "Lexus_GX470"). Lookup is case-insensitive.
 * Sizes in inches: driver, passenger, rear (rear null if no rear wiper).
 */
export const WIPER_SIZES_DB = {
  // Toyota
  "Toyota_Camry": { driver: '26"', passenger: '18"', rear: null },
  "Toyota_Corolla": { driver: '26"', passenger: '16"', rear: '12"' },
  "Toyota_RAV4": { driver: '26"', passenger: '16"', rear: '12"' },
  "Toyota_Highlander": { driver: '26"', passenger: '20"', rear: '12"' },
  "Toyota_Tacoma": { driver: '22"', passenger: '21"', rear: null },
  "Toyota_4Runner": { driver: '26"', passenger: '20"', rear: '16"' },
  "Toyota_Tundra": { driver: '22"', passenger: '22"', rear: null },
  "Toyota_Sequoia": { driver: '26"', passenger: '20"', rear: '16"' },
  "Toyota_Sienna": { driver: '26"', passenger: '20"', rear: '14"' },
  "Toyota_Prius": { driver: '26"', passenger: '16"', rear: null },
  "Toyota_Avalon": { driver: '26"', passenger: '19"', rear: null },
  "Toyota_Land Cruiser": { driver: '26"', passenger: '20"', rear: '16"' },
  "Toyota_Venza": { driver: '26"', passenger: '16"', rear: '12"' },
  "Toyota_C-HR": { driver: '26"', passenger: '16"', rear: '12"' },
  "Toyota_GR Corolla": { driver: '26"', passenger: '16"', rear: '12"' },
  "Toyota_Crown": { driver: '26"', passenger: '19"', rear: null },
  "Toyota_bZ4X": { driver: '26"', passenger: '16"', rear: '12"' },

  // Lexus
  "Lexus_GX470": { driver: '22"', passenger: '21"', rear: '16"' },
  "Lexus_GX460": { driver: '26"', passenger: '18"', rear: '14"' },
  "Lexus_RX350": { driver: '26"', passenger: '18"', rear: '14"' },
  "Lexus_RX330": { driver: '26"', passenger: '18"', rear: '14"' },
  "Lexus_ES350": { driver: '26"', passenger: '19"', rear: null },
  "Lexus_ES300": { driver: '26"', passenger: '18"', rear: null },
  "Lexus_IS250": { driver: '26"', passenger: '16"', rear: null },
  "Lexus_IS350": { driver: '26"', passenger: '16"', rear: null },
  "Lexus_NX": { driver: '26"', passenger: '16"', rear: '12"' },
  "Lexus_LX570": { driver: '26"', passenger: '20"', rear: '16"' },
  "Lexus_LX470": { driver: '26"', passenger: '20"', rear: '16"' },

  // Honda
  "Honda_Civic": { driver: '26"', passenger: '18"', rear: null },
  "Honda_Accord": { driver: '26"', passenger: '19"', rear: null },
  "Honda_CR-V": { driver: '26"', passenger: '17"', rear: '12"' },
  "Honda_Pilot": { driver: '26"', passenger: '21"', rear: '12"' },
  "Honda_Odyssey": { driver: '26"', passenger: '20"', rear: null },
  "Honda_HR-V": { driver: '26"', passenger: '16"', rear: '12"' },
  "Honda_Passport": { driver: '26"', passenger: '20"', rear: '12"' },
  "Honda_Ridgeline": { driver: '26"', passenger: '20"', rear: null },
  "Honda_Fit": { driver: '26"', passenger: '16"', rear: null },
  "Honda_CR-V Hybrid": { driver: '26"', passenger: '17"', rear: '12"' },
  "Honda_Accord Hybrid": { driver: '26"', passenger: '19"', rear: null },
  "Honda_Civic Type R": { driver: '26"', passenger: '18"', rear: null },

  // Acura
  "Acura_Integra": { driver: '26"', passenger: '18"', rear: null },
  "Acura_TL": { driver: '26"', passenger: '19"', rear: null },
  "Acura_TSX": { driver: '26"', passenger: '19"', rear: null },
  "Acura_MDX": { driver: '26"', passenger: '20"', rear: '12"' },
  "Acura_RDX": { driver: '26"', passenger: '17"', rear: '12"' },
  "Acura_ILX": { driver: '26"', passenger: '18"', rear: null },

  // Ford
  "Ford_F-150": { driver: '22"', passenger: '22"', rear: null },
  "Ford_F-250": { driver: '22"', passenger: '22"', rear: null },
  "Ford_F-350": { driver: '22"', passenger: '22"', rear: null },
  "Ford_F-450": { driver: '22"', passenger: '22"', rear: null },
  "Ford_Super Duty": { driver: '22"', passenger: '22"', rear: null },
  "Ford_Explorer": { driver: '26"', passenger: '20"', rear: '12"' },
  "Ford_Escape": { driver: '28"', passenger: '17"', rear: '12"' },
  "Ford_Mustang": { driver: '22"', passenger: '20"', rear: null },
  "Ford_Edge": { driver: '26"', passenger: '18"', rear: '12"' },
  "Ford_Bronco": { driver: '22"', passenger: '20"', rear: '12"' },
  "Ford_Bronco Sport": { driver: '26"', passenger: '16"', rear: '12"' },
  "Ford_Fusion": { driver: '26"', passenger: '19"', rear: null },
  "Ford_Expedition": { driver: '26"', passenger: '20"', rear: '12"' },
  "Ford_Ranger": { driver: '22"', passenger: '20"', rear: null },
  "Ford_Transit": { driver: '26"', passenger: '16"', rear: null },
  "Ford_Transit Connect": { driver: '26"', passenger: '16"', rear: null },
  "Ford_Focus": { driver: '26"', passenger: '18"', rear: null },
  "Ford_F-150 Lightning": { driver: '22"', passenger: '22"', rear: null },

  // Chevrolet
  "Chevrolet_Silverado": { driver: '22"', passenger: '22"', rear: null },
  "Chevrolet_Silverado 1500": { driver: '22"', passenger: '22"', rear: null },
  "Chevrolet_Silverado 2500": { driver: '22"', passenger: '22"', rear: null },
  "Chevrolet_Silverado 3500": { driver: '22"', passenger: '22"', rear: null },
  "Chevrolet_Equinox": { driver: '24"', passenger: '17"', rear: '12"' },
  "Chevrolet_Malibu": { driver: '26"', passenger: '19"', rear: null },
  "Chevrolet_Tahoe": { driver: '22"', passenger: '22"', rear: null },
  "Chevrolet_Suburban": { driver: '22"', passenger: '22"', rear: null },
  "Chevrolet_Traverse": { driver: '26"', passenger: '20"', rear: '12"' },
  "Chevrolet_Colorado": { driver: '22"', passenger: '20"', rear: null },
  "Chevrolet_Impala": { driver: '26"', passenger: '19"', rear: null },
  "Chevrolet_Cruze": { driver: '26"', passenger: '18"', rear: null },
  "Chevrolet_Blazer": { driver: '26"', passenger: '18"', rear: '12"' },
  "Chevrolet_Camaro": { driver: '22"', passenger: '20"', rear: null },
  "Chevrolet_Express": { driver: '22"', passenger: '22"', rear: null },
  "Chevrolet_Trax": { driver: '26"', passenger: '16"', rear: '12"' },
  "Chevrolet_Spark": { driver: '26"', passenger: '14"', rear: null },

  // Nissan
  "Nissan_Altima": { driver: '28"', passenger: '17"', rear: null },
  "Nissan_Rogue": { driver: '26"', passenger: '14"', rear: '12"' },
  "Nissan_Murano": { driver: '26"', passenger: '18"', rear: '12"' },
  "Nissan_Pathfinder": { driver: '26"', passenger: '20"', rear: '12"' },
  "Nissan_Frontier": { driver: '22"', passenger: '20"', rear: null },
  "Nissan_Titan": { driver: '22"', passenger: '22"', rear: null },
  "Nissan_Sentra": { driver: '26"', passenger: '16"', rear: null },
  "Nissan_Leaf": { driver: '26"', passenger: '18"', rear: null },
  "Nissan_Armada": { driver: '26"', passenger: '20"', rear: '12"' },

  // Jeep
  "Jeep_Wrangler": { driver: '18"', passenger: '18"', rear: '12"' },
  "Jeep_Grand Cherokee": { driver: '26"', passenger: '22"', rear: '14"' },
  "Jeep_Cherokee": { driver: '26"', passenger: '18"', rear: '12"' },
  "Jeep_Compass": { driver: '26"', passenger: '16"', rear: '12"' },
  "Jeep_Renegade": { driver: '26"', passenger: '16"', rear: '12"' },
  "Jeep_Gladiator": { driver: '22"', passenger: '20"', rear: null },

  // Hyundai
  "Hyundai_Tucson": { driver: '26"', passenger: '16"', rear: '12"' },
  "Hyundai_Elantra": { driver: '26"', passenger: '14"', rear: null },
  "Hyundai_Santa Fe": { driver: '26"', passenger: '18"', rear: '12"' },
  "Hyundai_Sonata": { driver: '26"', passenger: '19"', rear: null },
  "Hyundai_Kona": { driver: '26"', passenger: '16"', rear: '12"' },
  "Hyundai_Palisade": { driver: '26"', passenger: '20"', rear: '12"' },
  "Hyundai_Accent": { driver: '26"', passenger: '14"', rear: null },

  // Kia
  "Kia_Sorento": { driver: '26"', passenger: '18"', rear: '12"' },
  "Kia_Sportage": { driver: '26"', passenger: '16"', rear: '12"' },
  "Kia_Optima": { driver: '26"', passenger: '19"', rear: null },
  "Kia_Forte": { driver: '26"', passenger: '16"', rear: null },
  "Kia_Soul": { driver: '26"', passenger: '16"', rear: '12"' },
  "Kia_Telluride": { driver: '26"', passenger: '20"', rear: '12"' },
  "Kia_Seltos": { driver: '26"', passenger: '16"', rear: '12"' },

  // Subaru
  "Subaru_Outback": { driver: '26"', passenger: '17"', rear: '14"' },
  "Subaru_Forester": { driver: '26"', passenger: '17"', rear: '14"' },
  "Subaru_Crosstrek": { driver: '26"', passenger: '16"', rear: '12"' },
  "Subaru_Impreza": { driver: '26"', passenger: '16"', rear: null },
  "Subaru_Legacy": { driver: '26"', passenger: '19"', rear: null },
  "Subaru_Ascent": { driver: '26"', passenger: '20"', rear: '12"' },
  "Subaru_WRX": { driver: '26"', passenger: '16"', rear: null },

  // Mazda
  "Mazda_CX-5": { driver: '26"', passenger: '16"', rear: '12"' },
  "Mazda_CX-50": { driver: '26"', passenger: '16"', rear: '12"' },
  "Mazda_CX-9": { driver: '26"', passenger: '20"', rear: '12"' },
  "Mazda_Mazda3": { driver: '26"', passenger: '18"', rear: null },
  "Mazda_Mazda6": { driver: '26"', passenger: '19"', rear: null },

  // GMC
  "GMC_Sierra": { driver: '22"', passenger: '22"', rear: null },
  "GMC_Sierra 1500": { driver: '22"', passenger: '22"', rear: null },
  "GMC_Sierra 2500": { driver: '22"', passenger: '22"', rear: null },
  "GMC_Sierra 3500": { driver: '22"', passenger: '22"', rear: null },
  "GMC_Acadia": { driver: '26"', passenger: '20"', rear: '12"' },
  "GMC_Terrain": { driver: '24"', passenger: '17"', rear: '12"' },
  "GMC_Yukon": { driver: '22"', passenger: '22"', rear: null },
  "GMC_Yukon XL": { driver: '22"', passenger: '22"', rear: null },
  "GMC_Canyon": { driver: '22"', passenger: '20"', rear: null },
  "GMC_Savana": { driver: '22"', passenger: '22"', rear: null },
  "GMC_Hummer EV": { driver: '26"', passenger: '20"', rear: null },

  // Dodge
  "Dodge_Ram 1500": { driver: '24"', passenger: '21"', rear: null },
  "Dodge_Durango": { driver: '26"', passenger: '20"', rear: '12"' },
  "Dodge_Charger": { driver: '22"', passenger: '22"', rear: null },
  "Dodge_Challenger": { driver: '22"', passenger: '20"', rear: null },
  "Dodge_Journey": { driver: '26"', passenger: '18"', rear: '12"' },

  // RAM (often listed separately from Dodge)
  "RAM_1500": { driver: '24"', passenger: '21"', rear: null },
  "RAM_2500": { driver: '24"', passenger: '22"', rear: null },
  "RAM_3500": { driver: '24"', passenger: '22"', rear: null },
  "RAM_ProMaster": { driver: '26"', passenger: '16"', rear: null },
  "RAM_ProMaster City": { driver: '26"', passenger: '16"', rear: null },

  // Volkswagen
  "Volkswagen_Jetta": { driver: '25"', passenger: '19"', rear: null },
  "Volkswagen_Passat": { driver: '26"', passenger: '19"', rear: null },
  "Volkswagen_Tiguan": { driver: '26"', passenger: '18"', rear: '12"' },
  "Volkswagen_Atlas": { driver: '26"', passenger: '20"', rear: '12"' },
  "Volkswagen_Golf": { driver: '26"', passenger: '16"', rear: null },

  // BMW
  "BMW_3 Series": { driver: '24"', passenger: '19"', rear: null },
  "BMW_5 Series": { driver: '24"', passenger: '19"', rear: null },
  "BMW_X3": { driver: '26"', passenger: '18"', rear: '14"' },
  "BMW_X5": { driver: '26"', passenger: '20"', rear: '14"' },

  // Mercedes
  "Mercedes_C-Class": { driver: '22"', passenger: '22"', rear: null },
  "Mercedes_E-Class": { driver: '24"', passenger: '19"', rear: null },
  "Mercedes_GLC": { driver: '26"', passenger: '18"', rear: '14"' },
  "Mercedes_GLE": { driver: '26"', passenger: '20"', rear: '14"' },

  // Audi
  "Audi_A4": { driver: '26"', passenger: '19"', rear: null },
  "Audi_A6": { driver: '26"', passenger: '19"', rear: null },
  "Audi_Q5": { driver: '26"', passenger: '18"', rear: '14"' },
  "Audi_Q7": { driver: '26"', passenger: '20"', rear: '14"' },

  // Tesla
  "Tesla_Model 3": { driver: '26"', passenger: '19"', rear: null },
  "Tesla_Model Y": { driver: '26"', passenger: '19"', rear: null },
  "Tesla_Model S": { driver: '26"', passenger: '19"', rear: null },
  "Tesla_Model X": { driver: '26"', passenger: '20"', rear: null },

  // Other
  "Infiniti_Q50": { driver: '26"', passenger: '18"', rear: null },
  "Infiniti_QX60": { driver: '26"', passenger: '18"', rear: '12"' },
  "Lincoln_Navigator": { driver: '26"', passenger: '20"', rear: '12"' },
  "Lincoln_Aviator": { driver: '26"', passenger: '20"', rear: '12"' },
  "Volvo_XC90": { driver: '26"', passenger: '18"', rear: '14"' },
  "Volvo_XC60": { driver: '26"', passenger: '18"', rear: '14"' },
  "Land Rover_Discovery": { driver: '26"', passenger: '18"', rear: '14"' },
  "Land Rover_Range Rover": { driver: '26"', passenger: '20"', rear: '14"' },
  "Mitsubishi_Outlander": { driver: '26"', passenger: '18"', rear: '12"' },
  "Genesis_GV80": { driver: '26"', passenger: '18"', rear: '12"' },
  "Porsche_Cayenne": { driver: '26"', passenger: '20"', rear: '14"' },
};
