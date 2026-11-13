# frozen_string_literal: true

require 'date'
require 'json'
require 'fileutils'

# Mot du jour on the TRMNL X, run with `bin/trmnlp test mot-du-jour`.
# The clock is frozen at each `now:`; the day follows .trmnlp.yml's time_zone (America/Toronto, Montréal's).
RSpec.describe 'Mot du jour' do
  DEVICE = 'v2' # TRMNL X, 1040×780, 16 grays
  WORDS = JSON.parse(File.read(File.expand_path('../words.json', __dir__)))
  MONTHS = WORDS['months']

  IMAGE_BASE = File.read(File.expand_path('../src/full.liquid', __dir__))[/assign image_base = "([^"]+)"/, 1]
  LOCAL_IMAGES = File.expand_path('..', __dir__)

  # data: stands for the polled words.json, so the tests read this branch's list, not main's.
  def render_at(now) = trmnl.render(device: DEVICE, now:, data: WORDS, asset_overrides: { IMAGE_BASE => LOCAL_IMAGES })
  def word_at(now) = render_at(now).find('[data-word]')['data-word']
  def words_of(month) = MONTHS.fetch(month).map { it['word'] }

  it 'shows the day, the word and its picture, with no credit line' do
    screen = render_at('2026-11-13T08:00:00-05:00')
    expect(words_of('novembre')).to include(screen.find('[data-word]')['data-word'])
    expect(screen).to have_text('vendredi 13 novembre')
    expect(screen).to have_text(' · nom')
    expect(screen).not_to have_text('ARASAAC')
    expect(screen.problems).to be_empty
  end

  it 'keeps the day’s word in the evening, when UTC is already tomorrow' do
    expect(word_at('2026-11-12T19:30:00-05:00')).to eq(word_at('2026-11-12T08:00:00-05:00'))
  end

  it 'changes the word at local midnight' do
    expect(word_at('2026-11-13T00:05:00-05:00')).not_to eq(word_at('2026-11-12T23:55:00-05:00'))
  end

  it 'takes the word of the last evening of a month from that month, not the next' do
    expect(words_of('octobre')).to include(word_at('2026-10-31T21:00:00-04:00'))
  end

  # The reading aids: the first letter in a black box, the silent letters in pale gray, the example's word in bold.
  def expect_reading_aids(screen, entry)
    expect(screen).to have_css('.mdj-word .mdj-initial.bg--black', exact_text: entry['word'][0])
    expect(screen.all('.mdj-word .text--gray-55').map(&:text).join).to eq(entry['silent'].scan(/\((.*?)\)/).join)
    expect(screen.find('.mdj-example .text--bold').text).to eq(entry['example'][/\*(.+)\*/, 1])
    expect(screen).not_to have_text('*')
  end

  # Ten days from the 1st of each month: each of its words shows once, with its reading aids, and none runs off the Device.
  MONTHS.each_key.with_index(1) do |month, number|
    it "shows every word of #{month} once over 10 days, inside the Device" do
      first = Date.new(2027, number, 1)
      words = 10.times.map do |offset|
        screen = render_at("#{first + offset}T12:00:00-05:00")
        expect(screen.overflowing).to be_empty
        word = screen.find('[data-word]')['data-word']
        entry = MONTHS.fetch(month).find { it['word'] == word }
        expect_reading_aids(screen, entry)
        expect(screen.html).to include(IMAGE_BASE + entry.fetch('image'))
        expect(screen.evaluate('document.querySelector("img.mdj-picture").naturalWidth')).to eq(1024)
        expect(screen.problems).to be_empty
        if ENV['MDJ_PREVIEWS']
          FileUtils.mkdir_p(ENV.fetch('MDJ_PREVIEWS'))
          FileUtils.cp(screen.png_path, File.join(ENV.fetch('MDJ_PREVIEWS'), File.basename(entry.fetch('image'))))
        end
        word
      end
      expect(words).to match_array(words_of(month))
    end
  end
end
