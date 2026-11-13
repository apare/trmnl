# frozen_string_literal: true

require 'date'
require 'json'

# Mot du jour on the TRMNL X, run with `bin/trmnlp test mot-du-jour`.
# The clock is frozen at each `now:`; the day follows .trmnlp.yml's time_zone (America/Toronto, Montréal's).
RSpec.describe 'Mot du jour' do
  DEVICE = 'v2' # TRMNL X, 1040×780, 16 grays
  WORDS = JSON.parse(File.read(File.expand_path('../words.json', __dir__)))
  MONTHS = WORDS['months']

  # data: stands for the polled words.json, so the tests read this branch's list, not main's.
  def render_at(now) = trmnl.render(device: DEVICE, now:, data: WORDS)
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

  # Ten days from the 1st of each month: each of its words shows once, and none runs off the Device.
  MONTHS.each_key.with_index(1) do |month, number|
    it "shows every word of #{month} once over 10 days, inside the Device" do
      first = Date.new(2027, number, 1)
      words = 10.times.map do |offset|
        screen = render_at("#{first + offset}T12:00:00-05:00")
        expect(screen.overflowing).to be_empty
        screen.find('[data-word]')['data-word']
      end
      expect(words).to match_array(words_of(month))
    end
  end
end
