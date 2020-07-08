/**
 * Scraper for the mazuma website.
 *
 * Last date revised: 2020-05-25
 */

// Imports
const cheerio = require('cheerio');
const axios = require('axios');
const fs = require('fs');
const csv = require('fast-csv');
const cliProgress = require('cli-progress');

/**
 * getData is a method that takes in a url, scrapes data from the link and returns
 * data about the phone and it's children (variants of the phone).
 *
 * @param {*} url: Contains a list of urls (in string form).
 * @return : Returns the associated data with the url.
 */
const getData = async (url) => {
    const parent_url = url.split('/'); // Split the url into it's associated parts.
    const parent_id = parent_url[parent_url.length - 1]; // Grab the number associated with the url.
    const parent_category = parent_url[parent_url.length - 3]; // Grab the category the phone belongs in.

    const html = await axios.get(url); // Get the html from the website.
    const $ = await cheerio.load(html.data); // Parse the html.

    let phones = [];
    let phone = {};
    let parent = { id: +parent_id, category: parent_category };

    parent['brand'] = $('.brand').text();

    const carriers = ['Unlocked', '02', 'Vodafone', 'EE', '3'];
    const model_text = $('.model').text();
    const image = $('#phoneImage').attr('src');

    let words = model_text.split(' ');

    // Check if the carriers are in the model's text, remove the carrier if it is.
    if (carriers.includes(words[words.length - 1])) {
        words.pop();
        parent['model'] = words.join(' ');
    } else {
        parent['model'] = model_text;
    }

    // Saved in case defaults are needed in the future.
    /*const basic = $('#guaranteed-value').data()

    parent['good'] = basic.good
    parent['poor'] = basic.poor
    parent["faulty"] = basic.faulty
    parent["dead"] = basic.dead*/

    // Select the relevant data and retrieve information about the phone and it's children.
    if ($('body #select-network-variant').length) {
        $('#select-network-variant')
            .find('li')
            .each((index, element) => {
                const temp_phone = $(element).children().data();

                phone = {};
                phone['id'] = +temp_phone.fonId;
                phone['option'] = temp_phone.optionName;
                phone['good'] = +temp_phone.good;
                phone['poor'] = +temp_phone.poor;
                phone['faulty'] = +temp_phone.faulty;
                phone['dead'] = +temp_phone.dead;

                phones.push(phone);
            });
    }

    parent['children'] = phones; // Associate the children with the parent.
    parent['image'] = image;

    return { parent };
};

// Retrieve the urls from the input.csv file and later write the associated data to output.json
const getLinks = (path, endpath) => {
    const links = [];

    csv.parseFile(path, { headers: true })
        .on('data', (row) => {
            links.push(row['url']);
        })
        .on('end', () => {
            getPages(endpath, links);
        });
};

// Writes data to output.json.
const getPages = async (path, urls) => {
    let stream = fs.createWriteStream(path);

    let parents = [];
    let index = 0;

    const bar = new cliProgress.SingleBar(
        {},
        cliProgress.Presets.shades_classic
    );
    bar.start(urls.length, 0);

    for (url of urls) {
        const { parent } = await getData(url);
        bar.update(index++);
        parents.push(parent);
    }

    bar.stop();

    stream.write(JSON.stringify(parents, null, (space = 4)) + '\n');

    stream.end();
};

// Utility function to start the process.
const start = (path, endpath) => {
    getLinks(path, endpath);
};

start('input.csv', 'output.json');
