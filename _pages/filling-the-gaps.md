---
permalink: /filling-the-gaps/
title: "Filling the Gaps"
excerpt: "Reading Group"
author_profile: true
---

{% assign ftg = site.data.filling_the_gaps %}

<link rel="stylesheet" href="{{ '/assets/css/filling-the-gaps.css' | relative_url }}">

<div class="ftg-page">
  <p class="ftg-intro">{{ ftg.summary }}</p>

  <section class="ftg-next" aria-labelledby="ftg-next-title">
    <div>
      <p class="ftg-next__label">{{ ftg.next_session.label }}</p>
      <p class="ftg-next__date">{{ ftg.next_session.date }}</p>
    </div>
    <div>
      <h2 class="ftg-next__title" id="ftg-next-title">{{ ftg.next_session.title }}</h2>
      <p class="ftg-next__speaker"><strong>Speaker:</strong> {{ ftg.next_session.speaker }}</p>
      <p class="ftg-next__description">{{ ftg.next_session.description }}</p>
    </div>
  </section>

  <h2 class="ftg-section-title">Reading Group Sessions</h2>

  {% for season in ftg.seasons %}
    <h3 class="ftg-season">{{ season.title }}</h3>

    {% for session in season.sessions %}
      <article class="ftg-session">
        <div>
          {% if session.image %}
            <img class="ftg-session__image" src="{{ session.image | relative_url }}" alt="{{ session.speaker }}">
          {% else %}
            <div class="ftg-session__image ftg-session__image--placeholder" aria-hidden="true">{{ session.speaker | slice: 0 }}</div>
          {% endif %}
        </div>
        <div>
          <p class="ftg-session__date">{{ session.date }}</p>
          <h4 class="ftg-session__speaker">{{ session.speaker }}</h4>
          {% if session.affiliation %}
            <p class="ftg-session__affiliation">{{ session.affiliation }}</p>
          {% endif %}
          {% if session.title %}
            <p class="ftg-session__title">
              <span>{{ session.title }}</span>
              {% if session.presentation_url %}
                <a class="ftg-session__presentation-link" href="{{ session.presentation_url }}" target="_blank" rel="noopener noreferrer" aria-label="Open presentation" title="Open presentation">
                  <i class="fas fa-file-powerpoint ftg-session__presentation-icon" aria-hidden="true"></i>
                </a>
              {% endif %}
            </p>
          {% endif %}
          {% if session.abstract %}
            <p class="ftg-session__abstract">{{ session.abstract }}</p>
          {% endif %}
          {% if session.about %}
            <h5 class="ftg-session__about-title">About the Speaker</h5>
            <p class="ftg-session__about">{{ session.about }}</p>
          {% endif %}
        </div>
      </article>
    {% endfor %}
  {% endfor %}

</div>
