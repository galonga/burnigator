(function () {
  // Deterministic avatars for pinboard pseudonyms such as "Amber Fox 123".
  // The animal picks the icon, a colour word picks the colour, and everything
  // else comes from a hash of the full name, so a name always looks the same.
  const COLOR_WORDS = {
    amber: '#B45309',
    ash: '#5B6472',
    charcoal: '#374151',
    copper: '#B3532B',
    ember: '#C2410C',
    golden: '#A16207',
    indigo: '#4338CA',
    neon: '#0F766E',
    scarlet: '#B91C1C',
    silver: '#64748B',
    violet: '#6D28D9',
    yellow: '#A16207',
  };
  const PALETTE = [
    '#305EAA',
    '#C2306B',
    '#C2410C',
    '#0F766E',
    '#4D7C0F',
    '#6D28D9',
    '#0369A1',
    '#9D174D',
    '#B45309',
    '#1F7A4D',
    '#5B21B6',
    '#B91C1C',
  ];
  const ANIMAL_ICONS = {
    cat: 'fa-cat',
    caracal: 'fa-cat',
    lynx: 'fa-cat',
    ocelot: 'fa-cat',
    panther: 'fa-cat',
    tiger: 'fa-cat',
    dingo: 'fa-dog',
    jackal: 'fa-dog',
    fox: 'fa-dog',
    raccoon: 'fa-dog',
    crow: 'fa-crow',
    raven: 'fa-crow',
    crane: 'fa-dove',
    heron: 'fa-dove',
    ibis: 'fa-dove',
    robin: 'fa-kiwi-bird',
    wren: 'fa-kiwi-bird',
    finch: 'fa-kiwi-bird',
    sparrow: 'fa-kiwi-bird',
    starling: 'fa-kiwi-bird',
    puffin: 'fa-kiwi-bird',
    penguin: 'fa-kiwi-bird',
    eagle: 'fa-feather-pointed',
    falcon: 'fa-feather-pointed',
    kestrel: 'fa-feather-pointed',
    owl: 'fa-feather',
    parrot: 'fa-feather',
    peacock: 'fa-feather',
    beetle: 'fa-bug',
    bumblebee: 'fa-bug',
    cicada: 'fa-bug',
    cricket: 'fa-bug',
    firefly: 'fa-bug',
    moth: 'fa-bug',
    dragon: 'fa-dragon',
    phoenix: 'fa-fire',
    dolphin: 'fa-fish',
    octopus: 'fa-fish',
    seal: 'fa-otter',
    ferret: 'fa-otter',
    marten: 'fa-otter',
    stoat: 'fa-otter',
    gecko: 'fa-frog',
    newt: 'fa-frog',
    salamander: 'fa-frog',
    viper: 'fa-worm',
    comet: 'fa-meteor',
    bat: 'fa-moon',
    deer: 'fa-horse',
    bison: 'fa-hippo',
  };
  const ADJECTIVE_ICONS = {
    lunar: 'fa-moon',
    midnight: 'fa-moon',
    solar: 'fa-sun',
    summer: 'fa-sun',
    sunlit: 'fa-sun',
    stellar: 'fa-star',
    blazing: 'fa-fire',
    burning: 'fa-fire',
    flaming: 'fa-fire',
    kindled: 'fa-fire',
    molten: 'fa-fire',
    foxfire: 'fa-fire',
    electric: 'fa-bolt',
    neon: 'fa-bolt',
    winter: 'fa-snowflake',
    northern: 'fa-snowflake',
    glowing: 'fa-gem',
    shimmering: 'fa-gem',
    radiant: 'fa-gem',
  };
  const GENERIC_ICONS = [
    'fa-paw',
    'fa-feather',
    'fa-leaf',
    'fa-star',
    'fa-moon',
    'fa-sun',
    'fa-fire',
    'fa-bolt',
    'fa-seedling',
    'fa-snowflake',
    'fa-gem',
    'fa-wand-magic-sparkles',
  ];

  function hash(text) {
    let value = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      value ^= text.charCodeAt(i);
      value = Math.imul(value, 16777619) >>> 0;
    }
    return value;
  }

  function describe(name) {
    const text = String(name || '').trim();
    const words = text.toLowerCase().split(/\s+/).filter(Boolean);
    const digits = /^\d+$/;
    const letters = words.filter((word) => !digits.test(word));
    const adjective = letters[0] || '';
    const animal = letters[1] || letters[0] || '';
    const seed = hash(text.toLowerCase());
    const icon =
      ANIMAL_ICONS[animal] ||
      ADJECTIVE_ICONS[adjective] ||
      GENERIC_ICONS[Math.floor(seed / 7) % GENERIC_ICONS.length];
    const color = COLOR_WORDS[adjective] || PALETTE[seed % PALETTE.length];
    return { icon, color };
  }

  function create(name) {
    const { icon, color } = describe(name);
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.style.setProperty('--avatar-bg', color);
    const glyph = document.createElement('i');
    glyph.className = 'fa-solid ' + icon;
    avatar.appendChild(glyph);
    return avatar;
  }

  window.BurnigatorAvatar = { create, describe };
})();
