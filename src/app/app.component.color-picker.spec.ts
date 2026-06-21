import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AppComponent } from './app.component';
import { AppModule } from './app.module';
import { FileHandleStorageService } from './services/file-handle-storage.service';
import { PakEditorService } from './services/pak-editor.service';
import { PlayerImportService } from './services/player-import.service';
import { PlayerService } from './services/player.service';
import { TeamEditorService } from './services/team-editor.service';
import { TeamsDatService } from './services/teams-dat.service';
import { XlcEditorService } from './services/xlc-editor.service';

describe('AppComponent color sliders', () => {
  let fixture: ComponentFixture<AppComponent>;
  let component: AppComponent;
  let teamsDatService: {
    hasData: boolean;
    teamOptions: Array<{ value: number; label: string }>;
    kitStyleOptions: Array<{ value: number; label: string }>;
    sponsorTypeOptions: Array<{ value: number; label: string }>;
    europeanCompetitionOptions: Array<{ value: number; label: string }>;
    stadiumNameMaxLength: number;
    records: any[];
    updateKitColor: jasmine.Spy;
    updateStadiumColor: jasmine.Spy;
    updateRecord: jasmine.Spy;
  };

  beforeEach(async () => {
    teamsDatService = {
      hasData: true,
      teamOptions: [],
      kitStyleOptions: [],
      sponsorTypeOptions: [],
      europeanCompetitionOptions: [],
      stadiumNameMaxLength: 23,
      records: [
        {
          index: 0,
          teamId: 99,
          stadiumName: 'Arena',
          stadiumColor: { hex: '#102030', rawHex: '3020107F', fileOffset: 0x10F8, byteOffset: 0x10EC },
          pitchType: 3,
          linesUL: 11,
          linesUV: 22,
          linesPL: 33,
          linesPV: 44,
          kits: [
            {
              kitIndex: 0,
              label: 'Home',
              styleId: 0,
              styleLabel: 'Style 0',
              styleFileOffset: 0xBC,
              colors: [
                { colorIndex: 0, label: 'Shirt Primary', hex: '#445566', rawHex: '6655447F', fileOffset: 0x24 },
                { colorIndex: 1, label: 'Shirt Secondary', hex: '#556677', rawHex: '7766557F', fileOffset: 0x28 },
                { colorIndex: 2, label: 'Shirt Nr', hex: '#667788', rawHex: '8877667F', fileOffset: 0x2C },
                { colorIndex: 3, label: 'Socks', hex: '#223344', rawHex: '4433227F', fileOffset: 0x30 },
                { colorIndex: 4, label: 'Shorts', hex: '#778899', rawHex: '9988777F', fileOffset: 0x34 },
                { colorIndex: 5, label: 'Sponsor', hex: '#99AA11', rawHex: '11AA997F', fileOffset: 0x38 },
                { colorIndex: 6, label: 'Short Nr', hex: '#AA8833', rawHex: '3388AA7F', fileOffset: 0x3C },
                { colorIndex: 7, label: 'Shirt Lines', hex: '#113355', rawHex: '5533117F', fileOffset: 0x40 },
                { colorIndex: 8, label: 'Short Lines', hex: '#224466', rawHex: '6644227F', fileOffset: 0x44 },
                { colorIndex: 9, label: 'Socks Lines', hex: '#335577', rawHex: '7755337F', fileOffset: 0x48 }
              ]
            }
          ]
        }
      ],
      updateKitColor: jasmine.createSpy('updateKitColor'),
      updateStadiumColor: jasmine.createSpy('updateStadiumColor'),
      updateRecord: jasmine.createSpy('updateRecord')
    };

    await TestBed.configureTestingModule({
      imports: [AppModule],
      providers: [
        {
          provide: PlayerService,
          useValue: {
            getOvrTuningConfig: () => [],
            readPlayer: () => ({ pos: 11, nat: 0 }),
            getPlayerNameByIndex: () => 'Player',
            findPlayerIndexByName: () => -1,
            parsePlayerId: () => -1,
            formatPlayerId: () => '0001',
            calculateOVR: () => 70,
            binaryData: null,
            totalPlayers: 0
          }
        },
        {
          provide: PlayerImportService,
          useValue: {
            filterByTeam: () => [],
            mapImportedPlayer: () => ({ pos: 11, nat: 0 })
          }
        },
        {
          provide: PakEditorService,
          useValue: {
            hasData: false
          }
        },
        {
          provide: TeamEditorService,
          useValue: {
            hasData: false,
            teamOptions: [],
            getTeam: () => ({ offset: 0, teamId: 0, teamLabel: 'Team 0', playerCount: 0, slots: [] }),
            searchTeams: () => []
          }
        },
        {
          provide: TeamsDatService,
          useValue: teamsDatService
        },
        {
          provide: XlcEditorService,
          useValue: {
            getLocaleValueByKey: () => null,
            entries: []
          }
        },
        {
          provide: FileHandleStorageService,
          useValue: {
            getFileHandle: async () => null,
            saveFileHandle: async () => undefined,
            deleteFileHandle: async () => undefined
          }
        }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    spyOn<any>(component, 'registerRuntimeDebugHandlers').and.stub();
    spyOn<any>(component, 'initializeApp').and.returnValue(Promise.resolve());
  });

  it('updates the stadium color when the RGB slider change is committed', () => {
    component.showTeamStadiumDialog = true;
    component.teamStadiumDialogRecordIndex = 0;

    fixture.detectChanges();

    const input: HTMLInputElement | null = fixture.nativeElement.querySelector('.stadium-dialog-color-control .teams-dat-rgb-slider-input[data-channel="R"]');
    expect(input).not.toBeNull();

    input!.value = '17';
    input!.dispatchEvent(new Event('change'));

    expect(teamsDatService.updateStadiumColor).toHaveBeenCalledOnceWith(0, '#112030');
  });

  it('updates the kit color when the RGB slider change is committed', () => {
    component.showTeamKitDialog = true;
    component.teamKitDialogRecordIndex = 0;

    fixture.detectChanges();

    const input: HTMLInputElement | null = fixture.nativeElement.querySelector('.teams-dat-kit-controls .teams-dat-kit-color:first-child .teams-dat-rgb-slider-input[data-channel="R"]');
    expect(input).not.toBeNull();

    input!.value = '17';
    input!.dispatchEvent(new Event('change'));

    expect(teamsDatService.updateKitColor).toHaveBeenCalledOnceWith(0, 0, 0, '#115566');
  });

  it('renders all 10 kit controls in source order', () => {
    component.showTeamKitDialog = true;
    component.teamKitDialogRecordIndex = 0;

    fixture.detectChanges();

    const controls = fixture.nativeElement.querySelector('.teams-dat-kit-controls');
    const labels = Array.from(fixture.nativeElement.querySelectorAll('.teams-dat-kit-controls .teams-dat-kit-color-name') as NodeListOf<Element>).map((node) => node.textContent?.trim());

    expect(controls).not.toBeNull();
    expect(labels).toEqual([
      '1. Shirt Primary',
      '2. Shirt Secondary',
      '3. Shirt Nr',
      '4. Socks',
      '5. Shorts',
      '6. Sponsor',
      '7. Short Nr',
      '8. Shirt Lines',
      '9. Short Lines',
      '10. Socks Lines'
    ]);
  });

  it('shows line metadata in the kit dialog and not the stadium dialog', () => {
    component.showTeamStadiumDialog = true;
    component.teamStadiumDialogRecordIndex = 0;

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Lines U L');

    component.showTeamStadiumDialog = false;
    component.showTeamKitDialog = true;
    component.teamKitDialogRecordIndex = 0;

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Lines U L');
    expect(fixture.nativeElement.textContent).toContain('Lines U V');
    expect(fixture.nativeElement.textContent).toContain('Lines P L');
    expect(fixture.nativeElement.textContent).toContain('Lines P V');
  });

  it('updates line metadata from the kit dialog', () => {
    component.showTeamKitDialog = true;
    component.teamKitDialogRecordIndex = 0;

    fixture.detectChanges();

    const fields = Array.from(fixture.nativeElement.querySelectorAll('.kit-dialog-line-field input')) as HTMLInputElement[];
    expect(fields.length).toBe(4);

    fields[0].value = '101';
    fields[0].dispatchEvent(new Event('input'));

    expect(teamsDatService.updateRecord).toHaveBeenCalledWith(0, { linesUL: 101 });
  });

});