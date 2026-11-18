(function () {
  // Deterministic avatars for pinboard pseudonyms such as "Amber Fox 123".
  // The animal picks the icon, a colour word picks the colour, and everything
  // else comes from a hash of the full name, so a name always looks the same.
  // Colour words in a name steer the hue: [hue, saturation range or null for any].
  const COLOR_HUES = {
    amber: [38],
    ash: [215, [0.06, 0.16]],
    charcoal: [220, [0.08, 0.18]],
    copper: [20],
    ember: [14],
    golden: [44],
    indigo: [245],
    neon: [165],
    scarlet: [355],
    silver: [215, [0.08, 0.18]],
    violet: [268],
    yellow: [50],
  };
  // Backgrounds must stay dark enough for the white icon on top.
  const MIN_CONTRAST = 5.7;
  const START_LIGHTNESS = 0.36;
  const MIN_LIGHTNESS = 0.12;
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

  function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r, g, b] =
      h < 60
        ? [c, x, 0]
        : h < 120
          ? [x, c, 0]
          : h < 180
            ? [0, c, x]
            : h < 240
              ? [0, x, c]
              : h < 300
                ? [x, 0, c]
                : [c, 0, x];
    return [r + m, g + m, b + m];
  }

  function contrastWithWhite(rgb) {
    const [r, g, b] = rgb.map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return 1.05 / (luminance + 0.05);
  }

  // A random hue and saturation, darkened until the white icon has enough contrast.
  function darkColor(hue, saturation) {
    const h = ((hue % 360) + 360) % 360;
    let lightness = START_LIGHTNESS;
    while (lightness > MIN_LIGHTNESS && contrastWithWhite(hslToRgb(h, saturation, lightness)) < MIN_CONTRAST)
      lightness -= 0.01;
    return (
      'hsl(' + Math.round(h) + ' ' + Math.round(saturation * 100) + '% ' + Math.round(lightness * 100) + '%)'
    );
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
    const hint = COLOR_HUES[adjective];
    const baseHue = hint ? hint[0] + ((seed >>> 3) % 21) - 10 : seed % 360;
    const range = hint && hint[1] ? hint[1] : [0.45, 0.78];
    const saturation = range[0] + (((seed >>> 9) % 100) / 100) * (range[1] - range[0]);
    const shift = 24 + ((seed >>> 15) % 28);
    const from = darkColor(baseHue, saturation);
    const to = darkColor(baseHue + shift, saturation);
    return { icon, color: from, gradient: 'linear-gradient(135deg, ' + from + ', ' + to + ')' };
  }

  function create(name) {
    const { icon, gradient } = describe(name);
    const avatar = document.createElement('span');
    avatar.className = 'avatar';
    avatar.setAttribute('aria-hidden', 'true');
    avatar.style.setProperty('--avatar-bg', gradient);
    const glyph = document.createElement('i');
    glyph.className = 'fa-solid ' + icon;
    avatar.appendChild(glyph);
    return avatar;
  }

  window.BurnigatorAvatar = { create, describe };
})();
