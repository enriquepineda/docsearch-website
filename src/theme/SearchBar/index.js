/**
 * Copyright (c) 2017-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import React, {
  useState,
  useEffect,
  Fragment,
  useContext,
  useRef,
  useCallback,
} from 'react';
import classnames from 'classnames';
import DocusaurusContext from '@docusaurus/context';
import autocomplete, {
  getAlgoliaHits,
  getAlgoliaResults,
  snippetAlgoliaHit,
} from '@francoischalifour/autocomplete.js';

import './styles.css';

function groupBy(values, predicate) {
  return values.reduce(function(obj, item) {
    const key = predicate(item);
    if (!obj.hasOwnProperty(key)) {
      obj[key] = [];
    }
    obj[key].push(item);
    return obj;
  }, {});
}

function getLvl1(searchClient, treeLvl1) {
  return searchClient
    .search([
      {
        indexName: 'docsearch',
        query: '',
        params: {
          facetFilters: ['type:lvl1'],
          hitsPerPage: 1000,
          attributesToRetrieve: '*',
          attributesToSnippet: '*',
          highlightPreTag: '<mark>',
          highlightPostTag: '</mark>',
        },
      },
    ])
    .then(results => {
      const lvl1Hits = results.results[0].hits;
      return lvl1Hits.filter(hit => !!treeLvl1.includes(hit.hierarchy.lvl1));
    });
}

function getClasses(suggestion) {
  return suggestion.type;
}

const Search = props => {
  const context = useContext(DocusaurusContext);
  const { siteConfig = {} } = context;
  const {
    themeConfig: { algolia },
  } = siteConfig;

  const autocompleteRef = useRef(null);
  const [lvl1Hits, setLvl1Hits] = useState([]);

  useEffect(
    () => {
      if (!autocompleteRef.current) return;

      import('algoliasearch').then(({ default: algoliasearch }) => {
        const searchClient = algoliasearch('BH4D9OD16A', algolia.apiKey);

        autocomplete({
          container: autocompleteRef.current,
          dropdownContainer: '.navbar',
          dropdownAlignment: 'right',
          getDropdownPosition({ dropdownPosition }) {
            // Desktop: we want to return the dropdown position as is.
            if (window.matchMedia('(min-width: 540px)').matches) {
              return dropdownPosition;
            }
            // Mobile: we want to return the dropdown position without left or
            // right margins.
            return { top: dropdownPosition.top, left: 0 };
          },
          autofocus: true,
          minLength: 0,
          getSources({ query }) {
            return [
              {
                getSuggestionUrl({ suggestion }) {
                  return suggestion.url;
                },
                getSuggestions({ query }) {

                  // if (!query){
                  //   return [{'t'}]
                  //   // return emptyquerytemplate
                  // }
                  return getAlgoliaHits({
                    searchClient,
                    queries: [
                      {
                        indexName: algolia.indexName,
                        query,
                        params: {
                          attributesToRetrieve: '*',
                          attributesToSnippet: '*',
                          hitsPerPage: 10,
                        },
                      },
                    ],
                  }).then(async hits => {
                    let visitedTitles = [];
                    let treeLvl1 = [];

                    hits.map(hit => {
                      if (!treeLvl1.includes(hit.hierarchy.lvl1)) {
                        treeLvl1.push(hit.hierarchy.lvl1);
                      }
                      if (visitedTitles.includes(hit.hierarchy.lvl0)) {
                      } else {
                        visitedTitles.push(hit.hierarchy.lvl0);
                      }
                    });

                    const allLvl1 = await getLvl1(searchClient, treeLvl1);
                    const concatenedList = [...hits, ...allLvl1];

                    const treeList = concatenedList.filter(
                      (thing, index, self) =>
                        index ===
                        self.findIndex(
                          t =>
                            t.type === thing.type &&
                            t.hierarchy.lvl1 === thing.hierarchy.lvl1
                        )
                    );

                    const groupedResults = groupBy(
                      treeList,
                      item => item.hierarchy.lvl0
                    );

                    const sortedResults = Object.entries(groupedResults).map(
                      ([lvl0, sectionHits]) => {
                        const groupedSectionHits = groupBy(
                          sectionHits,
                          item => item.hierarchy.lvl1
                        );
                        let sortedSectionHits = Object.entries(
                          groupedSectionHits
                        ).map(([lvl1, subSectionHits]) => {
                          return subSectionHits.sort(
                            hit =>
                              hit.type === 'lvl1' &&
                              hit.hierarchy['lvl1'] === lvl1
                                ? -1
                                : 1
                          );
                        });
                        sortedSectionHits = Object.values(
                          sortedSectionHits
                        ).flat();

                        return sortedSectionHits.sort(hit => {
                          if (
                            hit.type !== 'lvl1' &&
                            hit.hierarchy['lvl0'] !== lvl0
                          ) {
                            return -1;
                          }
                          return 1;
                        });
                      }
                    );
                    visitedTitles = [];
                    treeLvl1 = [];

                    const flatSortedResults = Object.values(
                      sortedResults
                    ).flat();
                    let latestLvl0 = null;
                    let latestLvl1 = null;
                    let iteratorLvl0 = 0;
                    let reachedLvl0 = false;

                    return flatSortedResults.map((hit, index) => {
                      if (latestLvl0 !== hit.hierarchy.lvl0) {
                        reachedLvl0 = false;
                        iteratorLvl0 = 0;
                      }

                      if (hit.type === 'lvl1') {
                        iteratorLvl0++;
                      }

                      latestLvl0 = hit.hierarchy.lvl0;

                      if (reachedLvl0) {
                        hit.lastLvl0 = 'DSV3-lastLvl0';
                      }

                      if (
                        hit.type === 'lvl1' &&
                        latestLvl0 &&
                        iteratorLvl0 ==
                          groupedResults[hit.hierarchy.lvl0].filter(
                            hit => hit.type === 'lvl1'
                          ).length
                      ) {
                        hit.lastLvl0 = 'DSV3-lastLvl0';
                        reachedLvl0 = true;
                      }

                      if (
                        flatSortedResults.length === index + 1 ||
                        (hit.type !== 'lvl1' &&
                          flatSortedResults[index + 1] &&
                          flatSortedResults[index + 1].hierarchy.lvl1 !==
                            hit.hierarchy.lvl1)
                      ) {
                        hit.lastLvl1 = 'DSV3-lastLvl';
                      }

                      hit.position = index;
                      if (!treeLvl1.includes(hit.hierarchy.lvl1)) {
                        treeLvl1.push(hit.hierarchy.lvl1);
                      }
                      if (visitedTitles.includes(hit.hierarchy.lvl0)) {
                        return hit;
                      } else {
                        visitedTitles.push(hit.hierarchy.lvl0);
                        return { ...hit, _show: 'DSV3-firstLvl0' };
                      }
                      return hit;
                    });
                  });
                },
                templates: {
                  empty: () => {
                    return (
                      <div className="DSV3-noResults">No results</div>
                    )
                  },
                  footer: () => {
                    return (
                      <div>
                        <ul class="algolia-autocomplete-commands">
                          <li>
                            <svg viewBox="0 0 16 16">
                              <defs>
                                <path
                                  id="enter-a"
                                  d="M7,1.33333333 L7,3.66666667 C7,4.6 6.26564673,5.33333333 5.3310153,5.33333333 L2.12656467,5.33333333 L3.22809458,6.43333333 C3.36161335,6.56666667 3.36161335,6.76666667 3.22809458,6.9 C3.16133519,6.96666667 3.0945758,7 2.99443672,7 C2.89429764,7 2.82753825,6.96666667 2.76077886,6.9 L1.09179416,5.23333333 C1.05841446,5.2 1.02503477,5.16666667 1.02503477,5.13333333 C0.991655076,5.06666667 0.991655076,4.96666667 1.02503477,4.86666667 C1.05841446,4.83333333 1.05841446,4.8 1.09179416,4.76666667 L2.76077886,3.1 C2.89429764,2.96666667 3.0945758,2.96666667 3.22809458,3.1 C3.36161335,3.23333333 3.36161335,3.43333333 3.22809458,3.56666667 L2.12656467,4.66666667 L5.3310153,4.66666667 C5.8984701,4.66666667 6.33240612,4.23333333 6.33240612,3.66666667 L6.33240612,1.33333333 C6.33240612,1.13333333 6.4659249,1 6.66620306,1 C6.86648122,1 7,1.13333333 7,1.33333333 Z"
                                />
                              </defs>
                              <g fill="none" fillRule="evenodd">
                                <rect
                                  width="15"
                                  height="15"
                                  x=".5"
                                  y=".5"
                                  stroke="currentColor"
                                  rx="2"
                                  class="algolia-autocomplete-commands-border"
                                />
                                <g transform="translate(4 4)">
                                  <mask id="enter-b" fill="currentColor">
                                    <use xlinkHref="#enter-a" />
                                  </mask>
                                  <use
                                    fill="currentColor"
                                    fillRule="nonzero"
                                    xlinkHref="#enter-a"
                                  />
                                  <g fill="currentColor" mask="url(#enter-b)">
                                    <rect width="8" height="8" />
                                  </g>
                                </g>
                              </g>
                            </svg>
                            <span class="algolia-autocomplete-commands-description">
                              to select
                            </span>
                          </li>
                          <li>
                            <svg viewBox="0 0 16 16">
                              <defs>
                                <path
                                  id="a"
                                  d="M3.67 2.47L1.9 4.24a.33.33 0 0 1-.47-.48l2.33-2.33a.33.33 0 0 1 .48 0l2.33 2.33a.33.33 0 1 1-.47.48L4.33 2.47v3.86a.33.33 0 1 1-.66 0V2.47z"
                                />
                              </defs>
                              <g fill="none" fillRule="evenodd">
                                <rect
                                  width="15"
                                  height="15"
                                  x=".5"
                                  y=".5"
                                  stroke="currentColor"
                                  rx="2"
                                  class="algolia-autocomplete-commands-border"
                                />
                                <g transform="translate(4 4)">
                                  <mask id="b" fill="currentColor">
                                    <use xlinkHref="#a" />
                                  </mask>
                                  <use
                                    fill="currentColor"
                                    fillRule="nonzero"
                                    xlinkHref="#a"
                                  />
                                  <g fill="currentColor" mask="url(#b)">
                                    <path d="M0 0h8v8H0z" />
                                  </g>
                                </g>
                              </g>
                            </svg>
                            <svg viewBox="0 0 16 16">
                              <defs>
                                <path
                                  id="a"
                                  d="M3.67 2.47L1.9 4.24a.33.33 0 0 1-.47-.48l2.33-2.33a.33.33 0 0 1 .48 0l2.33 2.33a.33.33 0 1 1-.47.48L4.33 2.47v3.86a.33.33 0 1 1-.66 0V2.47z"
                                />
                              </defs>
                              <g fill="none" fillRule="evenodd">
                                <rect
                                  width="15"
                                  height="15"
                                  x=".5"
                                  y=".5"
                                  stroke="currentColor"
                                  rx="2"
                                  class="algolia-autocomplete-commands-border"
                                />
                                <g transform="matrix(1 0 0 -1 4 12)">
                                  <mask id="b" fill="currentColor">
                                    <use xlinkHref="#a" />
                                  </mask>
                                  <use
                                    fill="currentColor"
                                    fillRule="nonzero"
                                    xlinkHref="#a"
                                  />
                                  <g fill="currentColor" mask="url(#b)">
                                    <path d="M0 0h8v8H0z" />
                                  </g>
                                </g>
                              </g>
                            </svg>
                            <span class="algolia-autocomplete-commands-description">
                              to navigate
                            </span>
                          </li>
                          <li>
                            <svg viewBox="0 0 16 16">
                              <g fill="none" fillRule="evenodd">
                                <path
                                  fill="currentColor"
                                  fillRule="nonzero"
                                  d="M4.16 10.07c-1.07 0-1.73-.76-1.73-1.93v-.46c0-1.08.62-1.85 1.7-1.85 1.07 0 1.69.77 1.69 1.9v.38H3.1v.08c0 .78.4 1.31 1.06 1.31.48 0 .8-.23.92-.62h.67c-.15.68-.7 1.19-1.6 1.19zM3.1 7.57h2.03v-.01c0-.65-.4-1.17-1.01-1.17-.63 0-1.02.52-1.02 1.17v.01zm3.55-.5c0-.87.73-1.24 1.52-1.24.97 0 1.46.55 1.46 1.23h-.62c-.02-.31-.22-.68-.86-.68-.49 0-.84.21-.84.62 0 .46.54.56 1.01.64.77.14 1.42.35 1.42 1.15 0 .82-.66 1.28-1.63 1.28-.9 0-1.53-.44-1.53-1.18h.66c.06.38.38.63.93.63.62 0 .91-.3.91-.65 0-.46-.46-.55-1.03-.67-.77-.15-1.4-.39-1.4-1.13zm3.88 1.06v-.4c0-1.1.64-1.9 1.7-1.9.96 0 1.53.63 1.57 1.26h-.66a.89.89 0 0 0-.86-.67c-.68 0-1.08.5-1.08 1.33v.39c0 .8.43 1.33 1.08 1.33.51 0 .82-.27.89-.6h.66c-.14.7-.65 1.2-1.6 1.2-1.08 0-1.7-.84-1.7-1.94z"
                                />
                                <rect
                                  width="15"
                                  height="15"
                                  x=".5"
                                  y=".5"
                                  stroke="currentColor"
                                  rx="2"
                                  class="algolia-autocomplete-commands-border"
                                />
                              </g>
                            </svg>
                            <span class="algolia-autocomplete-commands-description">
                              to close
                            </span>
                          </li>
                        </ul>
                        <div class="algolia-autocomplete-logo">
                          <a href="https://www.algolia.com/docsearch">
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 168 24"
                            >
                              <g fill="none">
                                <path
                                  fill="currentColor"
                                  d="M6.972 6.677v1.627c-.712-.446-1.52-.67-2.425-.67-.585 0-1.045.13-1.38.391a1.24 1.24 0 0 0-.502 1.03c0 .425.164.765.494 1.02.33.256.835.532 1.516.83.447.192.795.356 1.045.495.25.138.537.332.862.582.324.25.563.548.718.894.154.345.23.741.23 1.188 0 .947-.334 1.691-1.004 2.234-.67.542-1.537.814-2.601.814-1.18 0-2.16-.229-2.936-.686v-1.708c.84.628 1.814.942 2.92.942.585 0 1.048-.136 1.388-.407.34-.271.51-.646.51-1.125 0-.287-.1-.55-.302-.79-.203-.24-.42-.42-.655-.542-.234-.123-.585-.29-1.053-.503a61.27 61.27 0 0 1-.582-.271 13.67 13.67 0 0 1-.55-.287 4.275 4.275 0 0 1-.567-.351 6.92 6.92 0 0 1-.455-.4c-.18-.17-.31-.34-.39-.51-.08-.17-.155-.37-.224-.598a2.553 2.553 0 0 1-.104-.742c0-.915.333-1.638.998-2.17.664-.532 1.523-.798 2.576-.798.968 0 1.793.17 2.473.51zm7.468 5.696v-.287c-.022-.607-.187-1.088-.495-1.444-.309-.357-.75-.535-1.324-.535-.532 0-.99.194-1.373.583-.382.388-.622.949-.717 1.683h3.909zm1.005 2.792v1.404c-.596.34-1.383.51-2.362.51-1.255 0-2.255-.377-3-1.132-.744-.755-1.116-1.744-1.116-2.968 0-1.297.34-2.316 1.021-3.055.68-.74 1.548-1.11 2.6-1.11 1.033 0 1.852.323 2.458.966.606.644.91 1.572.91 2.784 0 .33-.033.676-.096 1.038h-5.314c.107.702.405 1.239.894 1.611.49.372 1.106.558 1.85.558.862 0 1.58-.202 2.155-.606zm6.605-1.77h-1.212c-.596 0-1.045.116-1.349.35-.303.234-.454.532-.454.894 0 .372.117.664.35.877.235.213.575.32 1.022.32.51 0 .912-.142 1.204-.424.293-.281.44-.651.44-1.108v-.91zm-4.068-2.554V9.325c.627-.361 1.457-.542 2.489-.542 2.116 0 3.175 1.026 3.175 3.08V17h-1.548v-.957c-.415.68-1.143 1.02-2.186 1.02-.766 0-1.38-.22-1.843-.661-.462-.442-.694-1.003-.694-1.684 0-.776.293-1.38.878-1.81.585-.431 1.404-.647 2.457-.647h1.34V11.8c0-.554-.133-.971-.399-1.253-.266-.282-.707-.423-1.324-.423a4.07 4.07 0 0 0-2.345.718zm9.333-1.93v1.42c.394-1 1.101-1.5 2.123-1.5.148 0 .313.016.494.048v1.531a1.885 1.885 0 0 0-.75-.143c-.542 0-.989.24-1.34.718-.351.479-.527 1.048-.527 1.707V17h-1.563V8.91h1.563zm5.01 4.084c.022.82.272 1.492.75 2.019.479.526 1.15.79 2.01.79.639 0 1.235-.176 1.788-.527v1.404c-.521.319-1.186.479-1.995.479-1.265 0-2.276-.4-3.031-1.197-.755-.798-1.133-1.792-1.133-2.984 0-1.16.38-2.151 1.14-2.975.761-.825 1.79-1.237 3.088-1.237.702 0 1.346.149 1.93.447v1.436a3.242 3.242 0 0 0-1.77-.495c-.84 0-1.513.266-2.019.798-.505.532-.758 1.213-.758 2.042zM40.24 5.72v4.579c.458-1 1.293-1.5 2.505-1.5.787 0 1.42.245 1.899.734.479.49.718 1.17.718 2.042V17h-1.564v-5.106c0-.553-.14-.98-.422-1.284-.282-.303-.652-.455-1.11-.455-.531 0-1.002.202-1.411.606-.41.405-.615 1.022-.615 1.851V17h-1.563V5.72h1.563zm14.966 10.02c.596 0 1.096-.253 1.5-.758.404-.506.606-1.157.606-1.955 0-.915-.202-1.62-.606-2.114-.404-.495-.92-.742-1.548-.742-.553 0-1.05.224-1.491.67-.442.447-.662 1.133-.662 2.058 0 .958.212 1.67.638 2.138.425.469.946.703 1.563.703zM53.004 5.72v4.42c.574-.894 1.388-1.341 2.44-1.341 1.022 0 1.857.383 2.506 1.149.649.766.973 1.781.973 3.047 0 1.138-.309 2.109-.925 2.912-.617.803-1.463 1.205-2.537 1.205-1.075 0-1.894-.447-2.457-1.34V17h-1.58V5.72h1.58zm9.908 11.104l-3.223-7.913h1.739l1.005 2.632 1.26 3.415c.096-.32.48-1.458 1.15-3.415l.909-2.632h1.66l-2.92 7.866c-.777 2.074-1.963 3.11-3.559 3.11a2.92 2.92 0 0 1-.734-.079v-1.34c.17.042.351.064.543.064 1.032 0 1.755-.57 2.17-1.708z"
                                />
                                <path
                                  class="algolia-autocomplete-logo-brand-outer"
                                  d="M78.988.938h16.594a2.968 2.968 0 0 1 2.966 2.966V20.5a2.967 2.967 0 0 1-2.966 2.964H78.988a2.967 2.967 0 0 1-2.966-2.964V3.897A2.961 2.961 0 0 1 78.988.938zm41.937 17.866c-4.386.02-4.386-3.54-4.386-4.106l-.007-13.336 2.675-.424v13.254c0 .322 0 2.358 1.718 2.364v2.248zm-10.846-2.18c.821 0 1.43-.047 1.855-.129v-2.719a6.334 6.334 0 0 0-1.574-.199 5.7 5.7 0 0 0-.897.069 2.699 2.699 0 0 0-.814.24c-.24.116-.439.28-.582.491-.15.212-.219.335-.219.656 0 .628.219.991.616 1.23s.938.362 1.615.362zm-.233-9.7c.883 0 1.629.109 2.231.328.602.218 1.088.525 1.444.915.363.396.609.922.76 1.483.157.56.232 1.175.232 1.85v6.874a32.5 32.5 0 0 1-1.868.314c-.834.123-1.772.185-2.813.185-.69 0-1.327-.069-1.895-.198a4.001 4.001 0 0 1-1.471-.636 3.085 3.085 0 0 1-.951-1.134c-.226-.465-.343-1.12-.343-1.803 0-.656.13-1.073.384-1.525a3.24 3.24 0 0 1 1.047-1.106c.445-.287.95-.492 1.532-.615a8.8 8.8 0 0 1 1.82-.185 8.404 8.404 0 0 1 1.972.24v-.438c0-.307-.035-.6-.11-.874a1.88 1.88 0 0 0-.384-.73 1.784 1.784 0 0 0-.724-.493 3.164 3.164 0 0 0-1.143-.205c-.616 0-1.177.075-1.69.164a7.735 7.735 0 0 0-1.26.307l-.321-2.192c.335-.117.834-.233 1.478-.349a10.98 10.98 0 0 1 2.073-.178zm52.842 9.626c.822 0 1.43-.048 1.854-.13V13.7a6.347 6.347 0 0 0-1.574-.199c-.294 0-.595.021-.896.069a2.7 2.7 0 0 0-.814.24 1.46 1.46 0 0 0-.582.491c-.15.212-.218.335-.218.656 0 .628.218.991.615 1.23.404.245.938.362 1.615.362zm-.226-9.694c.883 0 1.629.108 2.231.327.602.219 1.088.526 1.444.915.355.39.609.923.759 1.483a6.8 6.8 0 0 1 .233 1.852v6.873c-.41.088-1.034.19-1.868.314-.834.123-1.772.184-2.813.184-.69 0-1.327-.068-1.895-.198a4.001 4.001 0 0 1-1.471-.635 3.085 3.085 0 0 1-.951-1.134c-.226-.465-.343-1.12-.343-1.804 0-.656.13-1.073.384-1.524.26-.45.608-.82 1.047-1.107.445-.286.95-.491 1.532-.614a8.803 8.803 0 0 1 2.751-.13c.329.034.671.096 1.04.185v-.437a3.3 3.3 0 0 0-.109-.875 1.873 1.873 0 0 0-.384-.731 1.784 1.784 0 0 0-.724-.492 3.165 3.165 0 0 0-1.143-.205c-.616 0-1.177.075-1.69.164a7.75 7.75 0 0 0-1.26.307l-.321-2.193c.335-.116.834-.232 1.478-.348a11.633 11.633 0 0 1 2.073-.177zm-8.034-1.271a1.626 1.626 0 0 1-1.628-1.62c0-.895.725-1.62 1.628-1.62.904 0 1.63.725 1.63 1.62 0 .895-.733 1.62-1.63 1.62zm1.348 13.22h-2.689V7.27l2.69-.423v11.956zm-4.714 0c-4.386.02-4.386-3.54-4.386-4.107l-.008-13.336 2.676-.424v13.254c0 .322 0 2.358 1.718 2.364v2.248zm-8.698-5.903c0-1.156-.253-2.119-.746-2.788-.493-.677-1.183-1.01-2.067-1.01-.882 0-1.574.333-2.065 1.01-.493.676-.733 1.632-.733 2.788 0 1.168.246 1.953.74 2.63.492.683 1.183 1.018 2.066 1.018.882 0 1.574-.342 2.067-1.019.492-.683.738-1.46.738-2.63zm2.737-.007c0 .902-.13 1.584-.397 2.33a5.52 5.52 0 0 1-1.128 1.906 4.986 4.986 0 0 1-1.752 1.223c-.685.286-1.739.45-2.265.45-.528-.006-1.574-.157-2.252-.45a5.096 5.096 0 0 1-1.744-1.223c-.487-.527-.863-1.162-1.137-1.906a6.345 6.345 0 0 1-.41-2.33c0-.902.123-1.77.397-2.508a5.554 5.554 0 0 1 1.15-1.892 5.133 5.133 0 0 1 1.75-1.216c.679-.287 1.425-.423 2.232-.423.808 0 1.553.142 2.237.423a4.88 4.88 0 0 1 1.753 1.216 5.644 5.644 0 0 1 1.135 1.892c.287.738.431 1.606.431 2.508zm-20.138 0c0 1.12.246 2.363.738 2.882.493.52 1.13.78 1.91.78.424 0 .828-.062 1.204-.178.377-.116.677-.253.917-.417V9.33a10.476 10.476 0 0 0-1.766-.226c-.971-.028-1.71.37-2.23 1.004-.513.636-.773 1.75-.773 2.788zm7.438 5.274c0 1.824-.466 3.156-1.404 4.004-.936.846-2.367 1.27-4.296 1.27-.705 0-2.17-.137-3.34-.396l.431-2.118c.98.205 2.272.26 2.95.26 1.074 0 1.84-.219 2.299-.656.459-.437.684-1.086.684-1.948v-.437a8.07 8.07 0 0 1-1.047.397c-.43.13-.93.198-1.492.198-.739 0-1.41-.116-2.018-.349a4.206 4.206 0 0 1-1.567-1.025c-.431-.45-.774-1.017-1.013-1.694-.24-.677-.363-1.885-.363-2.773 0-.834.13-1.88.384-2.577.26-.696.629-1.298 1.129-1.796.493-.498 1.095-.881 1.8-1.162a6.605 6.605 0 0 1 2.428-.457c.87 0 1.67.109 2.45.24.78.129 1.444.265 1.985.415V18.17z"
                                />
                                <path
                                  class="algolia-autocomplete-logo-brand-inner"
                                  d="M89.632 5.967v-.772a.978.978 0 0 0-.978-.977h-2.28a.978.978 0 0 0-.978.977v.793c0 .088.082.15.171.13a7.127 7.127 0 0 1 1.984-.28c.65 0 1.295.088 1.917.259.082.02.164-.04.164-.13m-6.248 1.01l-.39-.389a.977.977 0 0 0-1.382 0l-.465.465a.973.973 0 0 0 0 1.38l.383.383c.062.061.15.047.205-.014.226-.307.472-.601.746-.874.281-.28.568-.526.883-.751.068-.042.075-.137.02-.2m4.16 2.453v3.341c0 .096.104.165.192.117l2.97-1.537c.068-.034.089-.117.055-.184a3.695 3.695 0 0 0-3.08-1.866c-.068 0-.136.054-.136.13m0 8.048a4.489 4.489 0 0 1-4.49-4.482 4.488 4.488 0 0 1 4.49-4.482 4.488 4.488 0 0 1 4.489 4.482 4.484 4.484 0 0 1-4.49 4.482m0-10.85a6.363 6.363 0 1 0 0 12.729 6.37 6.37 0 0 0 6.372-6.368 6.358 6.358 0 0 0-6.371-6.36"
                                />
                              </g>
                            </svg>
                          </a>
                        </div>
                      </div>
                    );
                  },
                  suggestion: ({ suggestion }) => {
                    return (
                      <a href={suggestion.url}>
                        {suggestion._show && (
                          <div class="DSV3-cat-separator">
                            {suggestion.hierarchy.lvl0}
                          </div>
                        )}
                        <div
                          className={
                            `DSV3-${suggestion.type}` +
                            ' ' +
                            (suggestion.lastLvl1 || '') +
                            ' ' +
                            (suggestion.lastLvl0 || '') +
                            ' ' +
                            (suggestion._show || '')
                          }
                        >
                          {suggestion.hierarchy[suggestion.type] && (
                            <div>
                              {suggestion.type == 'lvl1' && (
                                <div>
                                  <span
                                    class="DSV3-title"
                                    dangerouslySetInnerHTML={{
                                      __html: snippetAlgoliaHit({
                                        hit: suggestion,
                                        attribute: 'hierarchy.lvl1',
                                      }),
                                    }}
                                  />
                                  {suggestion.content && (
                                  <div
                                    class="DSV3-text"
                                    dangerouslySetInnerHTML={{
                                      __html: snippetAlgoliaHit({
                                        hit: suggestion,
                                        attribute: 'content',
                                      }),
                                    }}
                                  />
                                  )}
                                </div>
                              )}
                              {(suggestion.type == 'lvl2' ||
                                suggestion.type == 'lvl3') && (
                                <div>
                                  <span
                                    class="DSV3-title"
                                    dangerouslySetInnerHTML={{
                                      __html:
                                        snippetAlgoliaHit({
                                          hit: suggestion,
                                          attribute: `hierarchy.${
                                            suggestion.type
                                          }`,
                                        }),
                                    }}
                                  />
                                  {suggestion.content && (
                                  <div
                                    class="DSV3-text"
                                    dangerouslySetInnerHTML={{
                                      __html: snippetAlgoliaHit({
                                        hit: suggestion,
                                        attribute: 'content',
                                      }),
                                    }}
                                  />
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                          {!suggestion.hierarchy[suggestion.type] &&
                            suggestion.type == 'content' && (
                              <div>
                                <span class="DSV3-title">
                                  {suggestion.hierarchy.lvl3 ||
                                    suggestion.hierarchy.lvl2 || "#"}
                                </span>
                                {suggestion.content && (
                                <div
                                  class="DSV3-text"
                                  dangerouslySetInnerHTML={{
                                    __html:
                                      snippetAlgoliaHit({
                                        hit: suggestion,
                                        attribute: 'content',
                                      }) + '...',
                                  }}
                                />
                              )}
                              </div>
                            )}
                        </div>
                      </a>
                    );
                  },
                },
              },
            ];
          },
        });
      });
    },
    [autocompleteRef]
  );

  return <div ref={autocompleteRef} />;
};

export default Search;
