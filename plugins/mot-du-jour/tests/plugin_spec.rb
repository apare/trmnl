# frozen_string_literal: true

require 'date'
require 'json'

# Mot du jour on the TRMNL X, run with `bin/trmnlp test mot-du-jour`.
# The clock is frozen at each `now:`; the day follows .trmnlp.yml's time_zone (America/Toronto, Montréal's).
RSpec.describe 'Mot du jour' do
  DEVICE = 'v2' # TRMNL X, 1040×780, 16 grays
  SEASONS = JSON.parse(File.read(File.expand_path('../words.json', __dir__)))['seasons']

  def render_at(now) = trmnl.render(device: DEVICE, now:)
  def word_at(now) = render_at(now).find('[data-word]')['data-word']

  it 'shows the day, the word, its syllables, its picture and the credit' do
    screen = render_at('2026-11-13T08:00:00-05:00')
    word = screen.find('[data-word]')['data-word']
    expect(SEASONS['autumn'].map { it['word'] }).to include(word)
    expect(screen).to have_text('vendredi 13 novembre')
    expect(screen).to have_text(' · nom')
    expect(screen).to have_text('Pictogramme : Sergio Palao, ARASAAC (CC BY-NC-SA)')
    expect(screen.problems).to be_empty
  end

  it 'keeps the day’s word in the evening, when UTC is already tomorrow' do
    expect(word_at('2026-11-12T19:30:00-05:00')).to eq(word_at('2026-11-12T08:00:00-05:00'))
  end

  it 'changes the word at local midnight' do
    expect(word_at('2026-11-13T00:05:00-05:00')).not_to eq(word_at('2026-11-12T23:55:00-05:00'))
  end

  {
    '2026-12-01' => 'winter', '2027-02-28' => 'winter', '2027-03-01' => 'spring', '2027-05-31' => 'spring',
    '2027-06-01' => 'summer', '2027-08-31' => 'summer', '2027-09-01' => 'autumn', '2027-11-30' => 'autumn'
  }.each do |date, season|
    it "takes the word of #{date} from the #{season} reserve" do
      expect(SEASONS[season].map { it['word'] }).to include(word_at("#{date}T12:00:00-05:00"))
    end
  end

  # One day in each month whose season starts there, then as many days as the reserve has words:
  # each word shows once, and none runs off the Device.
  { 'winter' => '2026-12-01', 'spring' => '2027-03-01', 'summer' => '2027-06-01', 'autumn' => '2026-09-01' }
    .each do |season, first|
    it "shows every #{season} word once over #{SEASONS[season].size} days, inside the Device" do
      words = SEASONS[season].size.times.map do |offset|
        screen = render_at("#{Date.parse(first) + offset}T12:00:00-05:00")
        expect(screen.overflowing).to be_empty
        screen.find('[data-word]')['data-word']
      end
      expect(words).to match_array(SEASONS[season].map { it['word'] })
    end
  end
end
