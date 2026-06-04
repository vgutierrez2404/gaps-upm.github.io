(function () {
  const container = document.getElementById("people-directory");
  const data = window.peopleData || {};

  if (!container || Object.keys(data).length === 0) {
    return;
  }

  const sections = [
    { key: "faculty", title: "Faculty" },
    { key: "non_faculty", title: "Non-faculty" },
    { key: "phd_students", title: "PhD Students" },
    { key: "distinguished_professors", title: "Distinguished former professors" },
    { key: "former", title: "Former Members" }
  ];

  const fragment = document.createDocumentFragment();

  sections.forEach((section) => {
    const entries = Array.isArray(data[section.key]) ? data[section.key] : [];
    if (entries.length === 0) {
      return;
    }

    // Render former members as a simple list, others as cards
    if (section.key === "former") {
      fragment.appendChild(renderFormerMembersSection(section, entries));
    } else {
      fragment.appendChild(renderSection(section, entries));
    }
  });

  if (!fragment.childNodes.length) {
    return;
  }

  container.classList.add("people-directory");
  container.appendChild(fragment);

  function renderFormerMembersSection(sectionConfig, entries) {
    const section = document.createElement("section");
    section.className = "people-section former-members-section";
    if (sectionConfig.key) {
      section.classList.add(`people-section--${sectionConfig.key}`);
    }
    if (sectionConfig.key) {
      section.id = sectionConfig.key;
    }

    const heading = document.createElement("h2");
    heading.className = "people-section__title";
    heading.textContent = sectionConfig.title;
    section.appendChild(heading);

    const list = document.createElement("ul");
    list.className = "former-members-list";

    entries
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      .forEach((person) => {
        const li = document.createElement("li");
        li.className = "former-member-item";
        
        if (person.email) {
          const link = document.createElement("a");
          link.href = `mailto:${person.email}`;
          link.textContent = person.name || "Unnamed";
          li.appendChild(link);
        } else {
          li.textContent = person.name || "Unnamed";
        }
        
        list.appendChild(li);
      });

    section.appendChild(list);
    return section;
  }

  function renderSection(sectionConfig, entries) {
    const section = document.createElement("section");
    section.className = "people-section";
    if (sectionConfig.key) {
      section.classList.add(`people-section--${sectionConfig.key}`);
    }
    if (sectionConfig.key) {
      section.id = sectionConfig.key;
    }

    const heading = document.createElement("h2");
    heading.className = "people-section__title";
    heading.textContent = sectionConfig.title;
    section.appendChild(heading);

    const grid = document.createElement("div");
    grid.className = "people-grid";

    entries
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
      .forEach((person) => {
        grid.appendChild(renderCard(person));
      });

    section.appendChild(grid);
    return section;
  }

  function renderCard(person) {
    const card = document.createElement("article");
    card.className = "person-card";
    const profileUrl = getProfileUrl(person);

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
      const overlay = document.createElement("div");
      overlay.className = "person-links-overlay";
      overlay.appendChild(linkList);
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

    if (person.title) {
      const titleEl = document.createElement("span");
      titleEl.className = "person-title";
      titleEl.textContent = person.title;
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

    if (person.description) {
      const description = document.createElement("p");
      description.className = "person-description";
      description.textContent = person.description;
      card.appendChild(description);
    }

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
