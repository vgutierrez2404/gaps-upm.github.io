(function () {
  const container = document.getElementById("people-directory");
  const data = window.peopleData || {};
  const records = window.peopleRecords || {};
  const directorSlug = "jose-luis-blanco-murillo";

  if (!container || Object.keys(data).length === 0) {
    return;
  }

  const sections = [
    { key: "faculty", title: "Faculty" },
    { key: "non_faculty", title: "Non-faculty" },
    { key: "phd_students", title: "PhD Student" },
    { key: "distinguished_professors", title: "Distinguished Former Professor" }
  ];

  const populatedSections = sections
    .map((section) => ({ ...section, entries: resolveEntries(data[section.key]) }))
    .filter((section) => section.entries.length > 0);

  const people = populatedSections
    .flatMap((section) => section.entries.map((person) => ({ person, section })));

  if (people.length === 0) {
    return;
  }

  container.classList.add("people-directory");
  const grid = document.createElement("div");
  grid.className = "people-grid";
  people.forEach(({ person, section }) => {
    grid.appendChild(renderCard(person, section));
  });
  container.appendChild(grid);

  function resolveEntries(entries) {
    if (!Array.isArray(entries)) {
      return [];
    }

    return entries
      .map((entry) => {
        if (typeof entry === "string") {
          const record = records[entry];
          return record ? { ...record, slug: record.slug || entry } : null;
        }

        return entry;
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.slug === directorSlug) return -1;
        if (b.slug === directorSlug) return 1;
        return (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' });
      });
  }

  function renderCard(person, section) {
    const card = document.createElement("article");
    card.className = "person-card";
    card.classList.add(`person-card--${section.key}`);
    const profileUrl = getProfileUrl(person);
    if (profileUrl) {
      card.classList.add("person-card--profile-link");
      card.addEventListener("click", (event) => {
        if (event.target.closest("a, button")) {
          return;
        }
        window.location.assign(profileUrl);
      });
    }

    const header = document.createElement("div");
    header.className = "person-header";

    const media = document.createElement("div");
    media.className = "person-media";

    const avatar = renderAvatar(person);
    if (profileUrl) {
      const avatarLink = document.createElement("a");
      avatarLink.className = "person-profile-link person-profile-link--media";
      avatarLink.href = profileUrl;
      avatarLink.setAttribute("aria-label", `View ${person.name || "person"} profile`);
      avatarLink.appendChild(avatar);
      media.appendChild(avatarLink);
    } else {
      media.appendChild(avatar);
    }

    const linkList = buildLinkList(person);
    if (linkList) {
      card.classList.add("person-card--has-links");
      const overlay = document.createElement("div");
      overlay.className = "person-links-overlay";
      overlay.appendChild(linkList);
      const profileHint = document.createElement("span");
      profileHint.className = "person-profile-hint";
      profileHint.textContent = "i";
      profileHint.title = "Click the card to open the personal profile";
      profileHint.setAttribute("aria-hidden", "true");
      overlay.appendChild(profileHint);
      media.appendChild(overlay);
    }

    header.appendChild(media);

    const meta = document.createElement("div");
    meta.className = "person-meta";

    const nameEl = document.createElement("h3");
    nameEl.className = "person-name";
    if (profileUrl) {
      const nameLink = document.createElement("a");
      nameLink.href = profileUrl;
      nameLink.textContent = person.name || "Unnamed";
      nameEl.appendChild(nameLink);
    } else {
      nameEl.textContent = person.name || "Unnamed";
    }
    meta.appendChild(nameEl);

    const displayedRole = person.slug === directorSlug
      ? `${section.title} · Group Director`
      : person.title || section.title;
    if (displayedRole) {
      const titleEl = document.createElement("span");
      titleEl.className = "person-title";
      titleEl.textContent = displayedRole;
      meta.appendChild(titleEl);
    }

    if (person.affiliation) {
      const affiliationEl = document.createElement("span");
      affiliationEl.className = "person-affiliation";
      affiliationEl.textContent = person.affiliation;
      meta.appendChild(affiliationEl);
    }

    header.appendChild(meta);
    card.appendChild(header);

    return card;
  }

  function renderAvatar(person) {
    if (person.photo) {
      const avatar = document.createElement("div");
      avatar.className = "person-avatar";
      avatar.style.backgroundColor = "#fff";
      const img = document.createElement("img");
      img.src = person.photo;
      img.alt = `${person.name || "Person"} portrait`;
      img.style.backgroundColor = "#fff";
      avatar.appendChild(img);
      return avatar;
    }

    const initials = getInitials(person.name || "");
    const placeholder = document.createElement("div");
    placeholder.className = "person-avatar-placeholder";
    placeholder.textContent = initials;
    placeholder.setAttribute("aria-hidden", initials ? "false" : "true");
    return placeholder;
  }

  function buildLinkList(person) {
    const items = [];

    if (person.email) {
      items.push({
        label: "Email",
        url: `mailto:${person.email}`
      });
    }

    if (Array.isArray(person.links)) {
      person.links.forEach((link) => {
        if (!link || !link.url) {
          return;
        }
        items.push({
          label: link.label || link.url.replace(/^https?:\/\//i, ""),
          url: link.url
        });
      });
    }

    if (!items.length) {
      return null;
    }

    const list = document.createElement("ul");
    list.className = "person-links";

    items.forEach((item) => {
      const li = document.createElement("li");
      const anchor = document.createElement("a");
      anchor.href = item.url;
      anchor.textContent = item.label;
      anchor.target = isExternal(item.url) ? "_blank" : "";
      anchor.rel = isExternal(item.url) ? "noreferrer noopener" : "";
      li.appendChild(anchor);
      list.appendChild(li);
    });

    return list;
  }

  function getInitials(name) {
    return name
      .split(/\s+/g)
      .filter(Boolean)
      .slice(0, 3)
      .map((part) => part[0])
      .join("")
      .toUpperCase()
      .slice(0, 3);
  }

  function isExternal(url) {
    return /^https?:\/\//i.test(url) && !url.includes(window.location.host);
  }

  function getProfileUrl(person) {
    if (!person || !person.slug) {
      return "";
    }

    const baseUrl = window.peopleBaseUrl || "/people/";
    return `${baseUrl.replace(/\/?$/, "/")}${person.slug}/`;
  }
})();
